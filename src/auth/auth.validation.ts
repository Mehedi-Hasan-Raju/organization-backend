
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
}).strict();





export const verifyEmailSchema = z.object({
  email: z.string().trim().email().max(254),
  code: z.string().regex(/^\d{6}$/, "Code must contain 6 digits"),
}).strict();

export const resendVerificationSchema = z.object({
  email: z.string().trim().email().max(254),
}).strict();

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254),
}).strict();

export const resetPasswordSchema = z.object({
  email: z.string().trim().email().max(254),
  code: z.string().regex(/^\d{6}$/, "Code must contain 6 digits"),
  password: z.string().min(8).max(72),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
}).strict();
