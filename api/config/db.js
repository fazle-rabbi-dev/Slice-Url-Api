import { MongoClient } from "mongodb";

const client = new MongoClient(`${process.env.MONGODB_URI}/slice-url`);

let db;

async function connectDB() {
    if (!db) {
        try {
            await client.connect();
            db = client.db("mern-url-shortener");
            console.log("Connected to MongoDB");
        } catch (err) {
            console.error("Failed to connect to MongoDB", err);
        }
    }
    return db;
}

export default connectDB;
