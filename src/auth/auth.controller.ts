import type { Request, Response } from "express";
import { registerUser } from "./auth.service.js";
import { loginUser } from "./auth.service.js";

import type { AuthenticatedRequest } from "../middlewares/authenticate.js";

export function getMe(req: AuthenticatedRequest, res: Response) {
  return res.status(200).json({
    success: true,
    message: "Authentication successful",
    user: req.user,
  });
}


export async function register(req: Request, res: Response) {
  try {
    const { name, email, password } = req.body ?? {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const user = await registerUser({ name, email, password });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: { user },
    });
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<string, { status: number; message: string }> = {
        INVALID_INPUT: {
          status: 400,
          message: "Invalid name or password length",
        },
        INVALID_EMAIL: {
          status: 400,
          message: "Please provide a valid email address",
        },
        WEAK_PASSWORD: {
          status: 400,
          message: "Password must be at least 8 characters",
        },
        EMAIL_EXISTS: {
          status: 409,
          message: "An account with this email already exists",
        },
      };

      const knownError = errors[error.message];

      if (knownError) {
        return res.status(knownError.status).json({
          success: false,
          message: knownError.message,
        });
      }
    }

    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to complete registration",
    });
  }
}


//login Controller

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password ||
      password.length > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid email and password are required",
      });
    }

    const result = await loginUser(email, password);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_CREDENTIALS") {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      if (error.message === "ACCOUNT_INACTIVE") {
        return res.status(403).json({
          success: false,
          message: "This account is not active",
        });
      }
    }

    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to complete login",
    });
  }
}
