import asyncHandler from "express-async-handler";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import admin from "firebase-admin";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

import serviceAccount from "../config/service-key.js";
import { accountConfirmationTemplate } from "../config/constants.js";
import {
    validateRegistration,
    validateLogin,
    isValidPassword,
    isValidUsername,
    isValidEmail,
    ApiResponse,
    ApiError,
    sendEmail,
    generateToken,
    generateConfirmationUrl
} from "../utils/index.js";
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";


// ========== Register ==========
export const registerUser = Users => {
    return asyncHandler(async (req, res) => {
        const { email, password, username, fullName } = req.body;
        const lowercasedUsername = username?.toLowerCase();

        // Validate input fields
        const validation = validateRegistration({
            email,
            password,
            username: lowercasedUsername,
            fullName
        });
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.message });
        }

        // Check if the user already exists
        const existingUser = await Users.findOne({
            $or: [{ email }, { username: lowercasedUsername }]
        });
        if (existingUser) {
            throw ApiError({
                statusCode: 409,
                message: "Email or username already exists"
            });
        }

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = {
            email,
            username: lowercasedUsername,
            fullName,
            password: hashedPassword,
            createdAt: new Date(),
            isAccountConfirmed: false,
            authType: "email+password"
        };

        const confirmationToken = generateToken();
        const confirmationUrl = generateConfirmationUrl(username, confirmationToken);
        
        const isEmailSent = await sendEmail({
            to: email,
            subject: "Slice Url - Account Confirmation",
            html: accountConfirmationTemplate(fullName, confirmationUrl)
        });

        if (!isEmailSent) {
            throw ApiError({
                statusCode: 500
            });
        }
        
        newUser.accountConfirmationToken = confirmationToken;
        const result = await Users.insertOne(newUser);
        delete newUser.password;

        ApiResponse(res, {
            statusCode: 201,
            message: "User registered successfully",
            data: { user: newUser }
        });
    });
};

// ========== Login ==========
export const loginUser = Users => {
    return asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        // Validate input fields
        const validation = validateLogin({ email, password });
        if (!validation.isValid) {
            throw ApiError({
                statusCode: 400,
                message: validation.message
            });
        }

        // Find the user by email
        const user = await Users.findOne({ email });
        if (!user) {
            throw ApiError({
                statusCode: 401,
                message: "Invalid email or password"
            });
        }

        // Compare provided password with hashed password in the database
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw ApiError({
                statusCode: 401,
                message: "Invalid email or password"
            });
        }

        // Check is account confirmation status
        if (!user.isAccountConfirmed) {
            throw ApiError({
                statusCode: 403,
                message:
                    "Your account is not confirmed. To log in, you must confirm your account. Please check your email inbox."
            });
        }

        // Generate JWT token
        const accessToken = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

        ApiResponse(res, {
            statusCode: 200,
            message: "Login successful",
            data: { user: { email: user.email, _id: user._id, name: user.name, accessToken } }
        });
    });
};

// ========== Confirm Account ==========
export const confirmAccount = Users => {
    return asyncHandler(async (req, res) => {
        const { username, token } = req.query;
        
        if (!isValidUsername(username?.trim()) && !token?.trim()) {
            throw ApiError({
                statusCode: 400,
                message: "Oops! You might have clicked on a broken URL"
            });
        }
        
        const existingUser = await Users.findOne({ username });
        if (!existingUser) {
            throw ApiError({
                statusCode: 400,
                message: "Oops! You might have clicked on a broken URL"
            });
        }

        // verify token
        if (token !== existingUser.accountConfirmationToken) {
            throw ApiError({
                statusCode: 400,
                message: "Oops! You might have clicked on a broken URL"
            });
        }

        // update status
        await Users.updateOne({ username }, { $set: { isAccountConfirmed: true, accountConfirmationToken: "" } });

        ApiResponse(res, {
            statusCode: 200,
            message: "Account confirmed successfully"
        });
    });
};

// ========== Social Auth ==========
export const socialAuth = Users => {
    return asyncHandler(async (req, res) => {
        const { accessToken } = req.body;
        
        // Validation
        if (!accessToken || accessToken?.trim().length < 1000) {
            throw ApiError({
                statusCode: 400,
                message: "Invalid access token. Please provide a valid access token."
            });
        }

        // Verify accessToken & find user
        let userRecord;
        try {
            userRecord = await getAuth().verifyIdToken(accessToken);
        } catch (error) {
            throw ApiError({
                statusCode: 400,
                message: "Invalid token"
            });
        }

        if (!userRecord) {
            throw ApiError({
                statusCode: 400,
                message: "User not found. Invalid token"
            });
        }

        const {
            name: fullName,
            email,
            firebase: { sign_in_provider }
        } = userRecord;
        const authType = sign_in_provider.split(".")[0];

        console.log({ userRecord, authType });

        // Check if user exists in Slice-Url database
        let existingUser = await Users.findOne({ email });

        // Check if user has already an account created using provided email with a password
        if (existingUser && !["github", "google"].includes(existingUser?.authType)) {
            throw ApiError({
                statusCode: 409,
                message: "Your email is associated with an account. Please login with your email & password"
            });
        }

        // Check if user has already an account created using either google or github
        if (existingUser && ["github", "google"].includes(existingUser?.authType)) {
            if (existingUser?.authType !== authType) {
                throw ApiError({
                    statusCode: 409,
                    message: `You have already an account. Try to login with ${authType}`
                });
            }
        }

        /*Create new account or Login to existing account*/
        let newUserAccount;
        let loginAccessToken = null;

        // Create account if user has no account
        if (!existingUser) {
            const newUser = {
                fullName,
                username: fullName.toLowerCase().replaceAll(" ", "") + Date.now(),
                email,
                password: "",
                isAccountConfirmed: true,
                authType,
                createdAt: new Date()
            };

            const createdUser = await Users.insertOne(newUser);
            console.log({ createdUser });

            // Login to new account
            const user = await Users.findOne({ email });

            console.log({ loggedInUser: user });

            if (user) {
                delete user.password;
                newUserAccount = user;
                loginAccessToken = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
            }
        }

        // Login if user has already an account
        if (existingUser) {
            loginAccessToken = jwt.sign({ userId: existingUser._id, email: existingUser.email }, JWT_SECRET, {
                expiresIn: "7d"
            });
            delete existingUser.password;
        }
        
        let userData = {};
        if(existingUser){
          userData = existingUser;
        } else {
          userData = newUserAccount;
        }
        
        ApiResponse(res, {
            statusCode: 200,
            message: `Login successful using ${authType}`,
            data: { user: { ...userData, accessToken: loginAccessToken } }
        });
    });
};

// ========== Change Password ==========
export const changePassword = Users => {
    return asyncHandler(async (req, res) => {
        const { oldPassword, newPassword } = req.body;
        const userId = req.userId;

        // Validate input fields
        if (!isValidPassword(oldPassword) || !isValidPassword(newPassword)) {
            throw ApiError({
                statusCode: 400,
                message: "Old password and new password are required"
            });
        }

        // Find the user by userId

        const user = await Users.findOne({ _id: new ObjectId(userId) });
        if (!user) {
            throw ApiError({
                statusCode: 404,
                message: "User not found"
            });
        }

        // Verify old password
        const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isOldPasswordValid) {
            throw ApiError({
                statusCode: 401,
                message: "Old password is incorrect"
            });
        }

        // Hash the new password
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update the user's password
        await Users.updateOne({ _id: new ObjectId(userId) }, { $set: { password: hashedNewPassword } });

        // Send success response
        ApiResponse(res, {
            statusCode: 200,
            message: "Password updated successfully"
        });
    });
};

// ========== Update Account ==========
export const updateAccount = Users => {
    return asyncHandler(async (req, res) => {
        const { username, fullName } = req.body;
        const userId = req.userId; // Ensure userId is set correctly by auth middleware
        
        // Check both field is present
        if (!username?.trim() && !fullName?.trim()) {
            throw ApiError({
                statusCode: 400,
                message: "Either a username or a full name is required to update account"
            });
        }

        // Validate username and full name
        const validUsername = isValidUsername(username);
        const validFullName = fullName?.length >= 4;

        if ((username && !validUsername) || (fullName && !validFullName)) {
            throw ApiError({
                statusCode: 400,
                message: "Invalid username or full name format"
            });
        }

        const updateFields = {};
        if (username) {
            updateFields.username = username.toLowerCase();
        }

        if (fullName) {
            updateFields.fullName = fullName;
        }

        // Check if username already exists
        let existingUser;
        if (username) {
            existingUser = await Users.findOne({
                username: username.toLowerCase()
            });
        }

        if (existingUser) {
            throw ApiError({
                statusCode: 409,
                message: "Username already exists"
            });
        }

        try {
            // Update the user's username and full name
            const result = await Users.updateOne({ _id: new ObjectId(userId) }, { $set: { ...updateFields } });

            /*if (result.modifiedCount === 0) {
  throw ApiError({
    statusCode: 500,
    message: 'Account update failed',
  });
}*/

            const updatedUser = await Users.findOne({ _id: new ObjectId(userId) });
            delete updatedUser.password;

            // Send success response
            ApiResponse(res, {
                statusCode: 200,
                message: "Account updated successfully",
                data: { user: updatedUser }
            });
        } catch (err) {
            throw ApiError({
                statusCode: 500,
                message: "An error occurred while updating the account"
            });
        }
    });
};

// ========== Get User Account ==========
export const getUser = Users => {
    return asyncHandler(async (req, res) => {
        const loggedInUserId = req.userId;
        const { userId } = req.params;

        if (loggedInUserId !== userId) {
            throw ApiError({
                statusCode: 403,
                message: "You do not have permission to access this resource"
            });
        }

        const user = await Users.findOne({ _id: new ObjectId(userId) });
        delete user.password;

        ApiResponse(res, {
            statusCode: 200,
            message: "User retrieved successfully",
            data: { user }
        });
    });
};
