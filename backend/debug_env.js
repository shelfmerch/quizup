const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const run = async () => {
    console.log("Current DIR:", __dirname);
    console.log("Files:", fs.readdirSync(__dirname));
    console.log("MONGO_URI:", process.env.MONGO_URI ? "Defined" : "Not Defined");
    console.log("MONGODB_URI:", process.env.MONGODB_URI ? "Defined" : "Not Defined");
    process.exit(0);
};

run();
