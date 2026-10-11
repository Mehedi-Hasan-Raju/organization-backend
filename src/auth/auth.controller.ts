import type { Request, Response } from "express";

import { loginUser,
         registerUser,
        verifyEmailCode,
        resendVerification,
        requestPasswordReset,
        resetPasswordWithCode,
 } from "./auth.service.js";

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

//email Verification

export async function verifyEmail(req: Request, res: Response) {
  try {
    await verifyEmailCode(req.body.email, req.body.code);

    return res.status(200).json({
      success: true,
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "INVALID_OR_EXPIRED_CODE") {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code.",
      });
    }

    if (message === "TOO_MANY_CODE_ATTEMPTS") {
      return res.status(429).json({
        success: false,
        message: "Too many attempts. Request a new code.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to verify email.",
    });
  }
}

//resend verification code

export async function resendVerificationCode(
  req: Request,
  res: Response
) {
  try {
    await resendVerification(req.body.email);

    return res.status(200).json({
      success: true,
      message: "If the account needs verification, a code will be sent.",
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Unable to send verification email. Please try again later.",
    });
  }
}

//forget Password

export async function forgotPassword(req: Request, res: Response) {
  try {
    await requestPasswordReset(req.body.email);

    return res.status(200).json({
      success: true,
      message: "If an eligible account exists, a reset code will be sent.",
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Unable to send reset email. Please try again later.",
    });
  }
}

//reset Password

export async function resetPassword(req: Request, res: Response) {
  try {
    await resetPasswordWithCode(
      req.body.email,
      req.body.code,
      req.body.password
    );

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in again.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "INVALID_PASSWORD") {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 72 characters.",
      });
    }

    if (message === "INVALID_OR_EXPIRED_CODE") {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code.",
      });
    }

    if (message === "TOO_MANY_CODE_ATTEMPTS") {
      return res.status(429).json({
        success: false,
        message: "Too many attempts. Request a new reset code.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to reset password.",
    });
  }
}
