import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

import { ApiResponse, ApiError, generateShortUrl, validateUrl, validateLinkAlias } from "../utils/index.js";

// ========== Create Short Link ==========
export const createShortLink = Links => {
    return asyncHandler(async (req, res) => {
        const { originalUrl } = req.body;
        const userId = req.userId;

        if (!originalUrl?.trim()) {
            throw ApiError({
                statusCode: 400,
                message: "Original Url is required"
            });
        }

        // Validate URL
        const validation = validateUrl(originalUrl);
        if (!validation.isValid) {
            throw ApiError({
                statusCode: 400,
                message: validation.message
            });
        }

        // Generate short URL
        const SERVER_ADDRESS = `${req.protocol}://${req.get("host")}`;
        const { shortId, shortUrl } = generateShortUrl(SERVER_ADDRESS);

        console.log({
            shortId,
            shortUrl
        });

        // Check shortId is already exists or not
        const existingShortId = await Links.findOne({ shortId });
        if (existingShortId) {
            throw ApiError({
                statusCode: 409,
                message: "There was an conflict error"
            });
        }

        // Create link document
        const newLink = {
            originalUrl,
            shortUrl,
            shortId,
            alias: "",
            creator: userId,
            clicks: 0,
            clickedAt: [],
            createdAt: new Date()
        };

        // Insert link into the links collection
        const result = await Links.insertOne(newLink);

        ApiResponse(res, {
            statusCode: 201,
            message: "Short URL created successfully",
            data: { newLink }
        });
    });
};

// ========== Get All Links ==========
export const getLinks = Links => {
    return asyncHandler(async (req, res) => {
        const userId = req.userId;

        const links = await Links.find({ creator: userId })?.toArray();
        
        ApiResponse(res, {
            statusCode: 200,
            message: "Links retrieved successfully",
            data: { links: links }
        });
    });
};

// ========== Get Single Links ==========
export const getSingleLink = Links => {
    return asyncHandler(async (req, res) => {
        const userId = req.userId;
        const { shortId } = req.params;

        if (!shortId?.trim() || shortId.length < 7) {
            throw ApiError({
                statusCode: 400,
                message: "Invalid link id"
            });
        }

        const link = await Links.findOne({ shortId });
        if (!link) {
            throw ApiError({
                statusCode: 404,
                message: "Link not found"
            });
        }

        // Verify Ownership
        if (link.creator !== userId) {
            throw ApiError({
                statusCode: 403,
                message: "You do not have permission to access this resource"
            });
        }

        ApiResponse(res, {
            statusCode: 200,
            message: "Link retrieved successfully",
            data: { link }
        });
    });
};

// ========== Handle Short Link Click ==========
export const handleShortLinkClick = Links => {
    return asyncHandler(async (req, res) => {
        const userId = req.userId;
        const { shortId } = req.params;
        const { source } = req.query;
        
        if (!shortId?.trim() || shortId.length < 3 || shortId.length > 10) {
            throw ApiError({
                statusCode: 400,
                message: "You might have clicked on a broken URL."
            });
        }

        const existingLink = await Links.findOne({
            $or: [{ shortId: shortId }, { alias: shortId }]
        });

        if (!existingLink) {
            throw ApiError({
                statusCode: 404,
                message: "You might have clicked on a broken URL."
            });
        }

        // Manage Url Click Stats
        const current_time = new Date();
        const user_agent = req.get("User-Agent");

        await Links.updateOne(
            { _id: existingLink._id },
            {
                $set: {
                    clicks: existingLink.clicks + 1,
                    clickedAt: [...existingLink.clickedAt, { time: current_time, user_agent, source: source || "unknown" }]
                }
            }
        );
        
        // res.redirect(existingLink.originalUrl);
        ApiResponse(res, {
          statusCode: 303,
          message: "Redirect",
          data: {
            url: existingLink.originalUrl
          }
        })
    });
};

// ========== Delete Link ==========
export const deleteLink = Links => {
    return asyncHandler(async (req, res) => {
        const userId = req.userId;
        const { shortId } = req.params;

        if (!shortId?.trim() || shortId.length < 7) {
            throw ApiError({
                statusCode: 404,
                message: "Link not found"
            });
        }

        const existingLink = await Links.findOne({ shortId });
        if (!existingLink) {
            throw ApiError({
                statusCode: 404,
                message: "Link not found"
            });
        }

        // Verify Ownership
        if (userId !== existingLink.creator) {
            throw ApiError({
                statusCode: 403,
                message: "You do not have permission to perform this operation"
            });
        }

        // Delete the link
        await Links.deleteOne({ shortId });

        ApiResponse(res, {
            statusCode: 200,
            message: "Link deleted successfully"
        });
    });
};

// ========== Change/Add Custom Link Alias ==========
export const changeLinkAlias = Links => {
    return asyncHandler(async (req, res) => {
        const userId = req.userId;
        const { shortId } = req.params;
        let { alias } = req.query;

        if (!shortId?.trim() || shortId.length < 7) {
            throw ApiError({
                statusCode: 404,
                message: "Link not found"
            });
        }

        if (!alias?.trim() || !validateLinkAlias(alias)) {
            throw ApiError({
                statusCode: 400,
                message:
                    "Invalid link alias. The alias must be at least 3 characters long and up to 10 characters long, and should contain only numbers and lowercase letters (a-z)."
            });
        }

        const existingLink = await Links.findOne({ shortId });
        if (!existingLink) {
            throw ApiError({
                statusCode: 404,
                message: "Link not found"
            });
        }

        // Verify Ownership
        if (userId !== existingLink.creator) {
            throw ApiError({
                statusCode: 403,
                message: "You do not have permission to perform this operation"
            });
        }

        // Check if the alias exists
        alias = alias.toLowerCase();
        const existingAlias = await Links.findOne({
            $or: [{ alias }, { shortId: alias }]
        });

        if (existingAlias) {
            throw ApiError({
                statusCode: 409,
                message: `This alias (${alias}) is already exists. Try a different one`
            });
        }

        // Update link alias
        const SERVER_ADDRESS = `${req.protocol}://${req.get("host")}`;
        const updatedLink = await Links.findOneAndUpdate(
            { shortId },
            {
                $set: {
                    alias,
                    shortUrl: `${SERVER_ADDRESS}/${alias}`
                }
            },
            { returnDocument: "after" }
        );

        if (!updatedLink) {
            throw ApiError({
                statusCode: 500,
                message: "Something went wrong while updating link alias"
            });
        }

        ApiResponse(res, {
            statusCode: 200,
            message: "Link alias updated successfully",
            data: { link: updatedLink }
        });
    });
};

/* Handle App Visitor Count */
export const visitorCount = Visitors => {
    return asyncHandler(async (req, res) => {
      const { source } = req.query;
      
      const existingVisitors = await Visitors.find({})?.toArray();
      
      const totalExistingVisitors = (existingVisitors?.length) > 0 ? Number(existingVisitors.length) : 0;
      const current_time = new Date();
      const user_agent = req.get("User-Agent");
      
      const newVisitor = {
        current_time,
        user_agent,
        source: source?.trim() || "unknown"
      };
      await Visitors.insertOne(newVisitor);
      
      ApiResponse(res, {
        statusCode: 200,
        message: "Visitor counted successfully"
      });
    });
};