import { Router } from "express";
import {
  createPost,
  deletePost,
  getPublishedPost,
  listPublishedPosts,
  updatePost,
} from "../controllers/postController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createPostSchema, updatePostSchema } from "../validators/post.js";

export const postsRouter = Router();

postsRouter.get("/", listPublishedPosts);
postsRouter.get("/:slug", getPublishedPost);

postsRouter.post("/", authenticate, validate(createPostSchema), createPost);
postsRouter.put("/:id", authenticate, validate(updatePostSchema), updatePost);
postsRouter.delete("/:id", authenticate, deletePost);
