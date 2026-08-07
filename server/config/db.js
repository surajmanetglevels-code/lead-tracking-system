const dns = require("dns");
const mongoose = require("mongoose");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from the .env file");
    }

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
    });

    console.log("[db] MongoDB connected successfully");
  } catch (error) {
    console.error(
      "[db] MongoDB connection failed:",
      error.message
    );

    throw error;
  }
};

module.exports = connectDB;