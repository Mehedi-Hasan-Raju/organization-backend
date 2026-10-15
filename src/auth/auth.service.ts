
import { Prisma } from "../../generated/prisma/client.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createHash, randomInt } from "node:crypto";

import { prisma } from "../config/prisma.js";

import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../config/email.js";


// Types and constants
// --------------------------------------------------

type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

const CODE_EXPIRY_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;


// Helper functions
// --------------------------------------------------

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashCode(userId: string, code: string): string {
  return createHash("sha256")
    .update(`${userId}:${code}`)
    .digest("hex");
}

function generateCode(): string {
  return randomInt(0, 1_000_000)
    .toString()
    .padStart(6, "0");
}


// Create and send verification code
// --------------------------------------------------

async function createVerificationCode(
  userId: string,
  email: string
): Promise<void> {
  const code = generateCode();

  await prisma.emailVerificationCode.deleteMany({
    where: { userId },
  });

  await prisma.emailVerificationCode.create({
    data: {
      userId,
      codeHash: hashCode(userId, code),
      expiresAt: new Date(Date.now() + CODE_EXPIRY_MS),
    },
  });

  await sendVerificationEmail(email, code);
}


// Register user
// --------------------------------------------------

export async function registerUser(input: RegisterInput) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!name || !email || !password) {
    throw new Error("INVALID_INPUT");
  }

  if (name.length < 2 || name.length > 100) {
    throw new Error("INVALID_INPUT");
  }

  if (password.length < 8 || password.length > 72) {
    throw new Error("WEAK_PASSWORD");
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("INVALID_EMAIL");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // The account is created as unverified.
    // If delivery fails, the user can request another code.
    await createVerificationCode(user.id, user.email);

    return user;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("EMAIL_EXISTS");
    }

    throw error;
  }
}

// --------------------------------------------------
// Login user
// --------------------------------------------------

export async function loginUser(
  emailInput: string,
  password: string
) {
  const email = normalizeEmail(emailInput);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!passwordMatches) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("ACCOUNT_INACTIVE");
  }

  if (!user.emailVerified) {
    throw new Error("EMAIL_NOT_VERIFIED");
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET_MISSING");
  }

  const token = jwt.sign(
    {
      role: user.role,
      tokenVersion: user.tokenVersion,
    },
    jwtSecret,
    {
      subject: user.id,
      expiresIn: "10d",
    }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  };
}

// --------------------------------------------------
// Resend verification email
// --------------------------------------------------

export async function resendVerification(
  emailInput: string
): Promise<void> {
  const email = normalizeEmail(emailInput);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Keep the response generic to avoid revealing accounts.
  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.emailVerified
  ) {
    return;
  }

  await createVerificationCode(user.id, user.email);
}

// --------------------------------------------------
// Verify email code
// --------------------------------------------------

export async function verifyEmailCode(
  emailInput: string,
  code: string
): Promise<void> {
  const email = normalizeEmail(emailInput);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || user.emailVerified) {
    throw new Error("INVALID_OR_EXPIRED_CODE");
  }

  const activeCode = await prisma.emailVerificationCode.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!activeCode || activeCode.expiresAt <= new Date()) {
    await prisma.emailVerificationCode.deleteMany({
      where: { userId: user.id },
    });

    throw new Error("INVALID_OR_EXPIRED_CODE");
  }

  const submittedHash = hashCode(user.id, code);

  if (activeCode.codeHash !== submittedHash) {
    const updated = await prisma.emailVerificationCode.updateMany({
      where: {
        id: activeCode.id,
        attempts: { lt: MAX_CODE_ATTEMPTS },
        expiresAt: { gt: new Date() },
      },
      data: {
        attempts: { increment: 1 },
      },
    });

    const latest = await prisma.emailVerificationCode.findUnique({
      where: { id: activeCode.id },
      select: { attempts: true },
    });

    if (
      updated.count === 0 ||
      !latest ||
      latest.attempts >= MAX_CODE_ATTEMPTS
    ) {
      await prisma.emailVerificationCode.deleteMany({
        where: { userId: user.id },
      });

      throw new Error("TOO_MANY_CODE_ATTEMPTS");
    }

    throw new Error("INVALID_OR_EXPIRED_CODE");
  }

  await prisma.$transaction(async (tx) => {
    // Recheck the code atomically before marking the account verified.
    const deleted = await tx.emailVerificationCode.deleteMany({
      where: {
        id: activeCode.id,
        userId: user.id,
        codeHash: submittedHash,
        expiresAt: { gt: new Date() },
        attempts: { lt: MAX_CODE_ATTEMPTS },
      },
    });

    if (deleted.count !== 1) {
      throw new Error("INVALID_OR_EXPIRED_CODE");
    }

    await tx.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    await tx.emailVerificationCode.deleteMany({
      where: { userId: user.id },
    });
  });
}

// --------------------------------------------------
// Request password reset
// --------------------------------------------------

export async function requestPasswordReset(
  emailInput: string
): Promise<void> {
  const email = normalizeEmail(emailInput);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Do not reveal whether the account exists.
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !user.emailVerified
  ) {
    return;
  }

  const code = generateCode();

  await prisma.passwordResetCode.deleteMany({
    where: { userId: user.id },
  });

  await prisma.passwordResetCode.create({
    data: {
      userId: user.id,
      codeHash: hashCode(user.id, code),
      expiresAt: new Date(Date.now() + CODE_EXPIRY_MS),
    },
  });

  await sendPasswordResetEmail(user.email, code);
}

// --------------------------------------------------
// Reset password using code
// --------------------------------------------------

export async function resetPasswordWithCode(
  emailInput: string,
  code: string,
  newPassword: string
): Promise<void> {
  if (
    newPassword.length < 8 ||
    newPassword.length > 72
  ) {
    throw new Error("INVALID_PASSWORD");
  }

  const email = normalizeEmail(emailInput);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new Error("INVALID_OR_EXPIRED_CODE");
  }

  const activeCode = await prisma.passwordResetCode.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!activeCode || activeCode.expiresAt <= new Date()) {
    await prisma.passwordResetCode.deleteMany({
      where: { userId: user.id },
    });

    throw new Error("INVALID_OR_EXPIRED_CODE");
  }

  const submittedHash = hashCode(user.id, code);

  if (activeCode.codeHash !== submittedHash) {
    const updated = await prisma.passwordResetCode.updateMany({
      where: {
        id: activeCode.id,
        attempts: { lt: MAX_CODE_ATTEMPTS },
        expiresAt: { gt: new Date() },
      },
      data: {
        attempts: { increment: 1 },
      },
    });

    const latest = await prisma.passwordResetCode.findUnique({
      where: { id: activeCode.id },
      select: { attempts: true },
    });

    if (
      updated.count === 0 ||
      !latest ||
      latest.attempts >= MAX_CODE_ATTEMPTS
    ) {
      await prisma.passwordResetCode.deleteMany({
        where: { userId: user.id },
      });

      throw new Error("TOO_MANY_CODE_ATTEMPTS");
    }

    throw new Error("INVALID_OR_EXPIRED_CODE");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    // Consume the valid code and change the password in one transaction.
    const deleted = await tx.passwordResetCode.deleteMany({
      where: {
        id: activeCode.id,
        userId: user.id,
        codeHash: submittedHash,
        expiresAt: { gt: new Date() },
        attempts: { lt: MAX_CODE_ATTEMPTS },
      },
    });

    if (deleted.count !== 1) {
      throw new Error("INVALID_OR_EXPIRED_CODE");
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });

    await tx.passwordResetCode.deleteMany({
      where: { userId: user.id },
    });
  });
}

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (
    typeof newPassword !== "string" ||
    newPassword.length < 8 ||
    newPassword.length > 72
  ) {
    throw new Error("INVALID_PASSWORD");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const passwordMatches = await bcrypt.compare(
    currentPassword,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new Error("INVALID_CURRENT_PASSWORD");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}
