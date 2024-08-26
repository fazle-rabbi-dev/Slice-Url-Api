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

    router.post("/auth/register", authLimiter, registerUser(Users));
    router.get("/auth/confirm-account", confirmAccount(Users));
    router.post("/auth/login", authLimiter, loginUser(Users));
    router.post("/auth/social", socialAuth(Users));
    router.put("/auth/change-password", verifyJwt, changePassword(Users));

    router.patch("/users/update-account", verifyJwt, updateAccount(Users));
    router.get("/users/:userId", verifyJwt, getUser(Users));
    
    // For seeding purpose
    // router.get("/seed/users", seedUsers(Users));
    
    return router;
};

export default useAuthRouter;
