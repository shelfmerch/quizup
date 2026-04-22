const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");
const {
  listCategories,
  createCategory,
  listQuestions,
  createQuestion,
} = require("../controllers/adminController");
const uploadQuestionImage = require("../middleware/uploadQuestionImage");

router.use(requireAuth, requireAdmin);

router.post("/upload-question-image", (req, res) => {
  uploadQuestionImage.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No image file" });
    }
    return res.json({ url: req.file.location });
  });
});

router.get("/categories", listCategories);
router.post("/categories", createCategory);
router.get("/questions", listQuestions);
router.post("/questions", createQuestion);

module.exports = router;
