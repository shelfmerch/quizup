const mongoose = require("mongoose");
require("dotenv").config();
const Question = require("./src/models/Question");

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const qs = await Question.find({ categoryId: "k-pop" }).sort({ createdAt: -1 }).lean();
        const baseTime = qs[0].createdAt.getTime();

        const randomIndex = Math.floor(Math.random() * 21);
        const newTime = new Date(baseTime - randomIndex);

        await Question.create({
            categoryId: "k-pop",
            text: "Which group does this idol belong to?",
            options: ["IVE", "ITZY", "aespa", "BLACKPINK"],
            correctIndex: 0,
            timeLimit: 10,
            imageUrl: "/uploads/wonyoung_ive.jpg",
            createdAt: newTime
        });

        console.log(`Inserted Wonyoung question at random index ${randomIndex}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
