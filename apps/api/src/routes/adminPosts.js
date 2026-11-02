import { Router } from "express";
import { getPostById, listAllPosts } from "../controllers/postController.js";
import { authenticate } from "../middleware/auth.js";

export const adminPostsRouter = Router();

adminPostsRouter.use(authenticate);
adminPostsRouter.get("/", listAllPosts);
adminPostsRouter.get("/:id", getPostById);
