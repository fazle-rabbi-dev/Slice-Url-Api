import express from "express";
const router = express.Router();

import {
    registerUser,
    confirmAccount,
    loginUser,
    socialAuth,
    changePassword,
    updateAccount,
    getUser
} from "../controllers/authController.js";
import { seedUsers } from "../controllers/seedController.js";
import { verifyJwt } from "../utils/index.js";
import { authLimiter } from "../utils/index.js";

const useAuthRouter = db => {
    const Users = db.collection("users");
    
    router.post("/api/auth/register", authLimiter, registerUser(Users));
    router.get("/api/auth/confirm-account", confirmAccount(Users));
    router.post("/api/auth/login", authLimiter, loginUser(Users));
    router.post("/api/auth/social", socialAuth(Users));
    router.put("/api/auth/change-password", verifyJwt, changePassword(Users));

    router.patch("/api/users/update-account", verifyJwt, updateAccount(Users));
    router.get("/api/users/:userId", verifyJwt, getUser(Users));
    
    // For seeding purpose
    // router.get("/seed/users", seedUsers(Users));
    
    return router;
};

export default useAuthRouter;
