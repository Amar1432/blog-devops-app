import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { unauthorized } from "../utils/AppError.js";

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name };
}

export async function login(req, res, next) {
  try {
    const email = req.body.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    const passwordMatches = user
      ? await bcrypt.compare(req.body.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      throw unauthorized("Invalid email or password");
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });

    res.json({ token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      throw unauthorized();
    }
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}
