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

app.get("/", (req, res) => {
  res.send(`<h1 style="color:#784beb">Hey 👋, there!</h1>`);
});

connectDB()
    .then(db => {
        app.use(useAuthRouter(db));
        app.use(useLinkRouter(db));
        
        app.get("/health", (req, res) => {
            res.status(200).json({
                message: "Ok"
            });
        });

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
        process.exit(1);
    });

// For vercel deployment
export default app;
