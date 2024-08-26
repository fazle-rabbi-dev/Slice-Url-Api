import { MongoClient } from "mongodb";

const client = new MongoClient(`${process.env.MONGODB_URI}/slice-url`);

let db;

async function connectDB() {
    if (!db) {
        try {
            await client.connect();
            db = client.db("mern-url-shortener");
            console.log("Connected to MongoDB");
            return db;
        } catch (err) {
            console.error("Failed to connect to MongoDB:", err);
            throw err;
    }
    return db;
  }
}

export default connectDB;
