const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { getCategories, getFollowedCategories, followCategory, unfollowCategory } = require("../controllers/categoryController");

router.get("/", getCategories);
router.get("/followed", requireAuth, getFollowedCategories);
router.post("/:slug/follow", requireAuth, followCategory);
router.delete("/:slug/follow", requireAuth, unfollowCategory);

module.exports = router;
