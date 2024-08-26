import { users } from "../config/constants.js";
import bcrypt from "bcryptjs";
import asyncHandler from "express-async-handler";

export const seedUsers = (Users) => {
  return asyncHandler(async (req, res) => {
    await Users.deleteMany({});

    const usersWithHashedPasswords = await Promise.all(
      users?.map(async (user) => {
        const hashedPassword = await bcrypt.hash(process.env.SEED_USER_PASSWORD || "123456", 10);
        return { ...user, password: hashedPassword };
      })
    );

    await Users.insertMany(usersWithHashedPasswords);

    const allUsers = await Users.find({}).toArray();
    
    res.json({
      ok: true,
      allUsers: allUsers
    });
  });
};