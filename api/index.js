import dotenv from "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

import useAuthRouter from "./routes/authRoutes.js";
import useLinkRouter from "./routes/linkRoutes.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(
	cors({
		origin: process.env.ENVIRONMENT === "dev" ? "*" : process.env.CORS_ORIGIN,
	}),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize mongodb connection
const MONGODB_URI = process.env.MONGODB_URI;
const client = new MongoClient(MONGODB_URI, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

const run = async () => {
	try {
		const database = client.db("mern-url-shortener");

		app.use(useAuthRouter(database));
		app.use(useLinkRouter(database));

		await database.command({ ping: 1 });
		console.log("Connected to database.");
	} finally {
		// await client.close();
	}
};

run().catch(console.dir);

app.get("/", (req, res) => {
	const database = client.db("mern-url-shortener");
	res.send(`<h1>Hey 👋, there!</h1> <code>Database Connected: ${database ? "yes" : "no"}</code>`);
});

app.get("/health", (req, res) => {
	res.status(200).json({
		statusCode: 200,
		message: "Ok",
	});
});

// Not found error handler
app.use("*", (req, res) => {
	res.status(404).json({
		statusCode: 404,
		message: "Route not found.",
	});
});

// Default error handler
app.use((err, req, res, next) => {
	console.error(err);

	res.status(err.statusCode || 500).json({
		success: false,
		statusCode: err.statusCode || 500,
		message: err.message || "Internal server error.",
	});
});

app.listen(port, () => {
	console.log(`Server started at: http://localhost:${port}`);
});

// For vercel deployment
export default app;
