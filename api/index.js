import dotenv from "dotenv/config";
import express from "express";
import cors from "cors";

import connectDB from "./config/db.js";
import useAuthRouter from "./routes/authRoutes.js";
import useLinkRouter from "./routes/linkRoutes.js";


const app = express();
const port = process.env.PORT || 3000;

app.use(
    cors({
        origin: process.env.ENVIRONMENT === "dev" ? "*" : process.env.CORS_ORIGIN
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
    res.status(200).json({
        message: "Ok"
    });
});

connectDB()
    .then(db => {
        app.use(useAuthRouter(db));
        app.use(useLinkRouter(db));

        app.use("*", (req, res) => {
            res.status(404).json({
                message: "Route not found."
            });
        });

        app.use((err, req, res, next) => {
            console.error(err);
            
            res.status(err.statusCode || 500).json({
                success: false,
                statusCode: err.statusCode || 500,
                message: err.message || "Internal server error."
            });
        });

        app.listen(port, () => {
            console.log(`Server started at: http://localhost:${port}`);
        });
    })
    .catch(err => {
        console.error("Failed to start server", err);
    });

// For vercel deployment
export default app;
