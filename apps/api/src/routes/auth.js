import { Router } from "express";
import { login, me } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { loginSchema } from "../validators/auth.js";

export const authRouter = Router();

authRouter.post("/login", validate(loginSchema), login);
authRouter.get("/me", authenticate, me);
