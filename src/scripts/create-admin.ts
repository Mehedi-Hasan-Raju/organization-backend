
import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../config/prisma.js";

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD must be configured in .env"
    );
  }

  if (password.length < 8 || password.length > 72) {
    throw new Error("Admin password must be between 8 and 72 characters");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    if (existingUser.role === "ADMIN") {
      console.log("This account is already an ADMIN.");
      return;
    }

    throw new Error(
      "An account with this email already exists. No changes were made."
    );
  }

  const admin = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  });

  console.log("Admin account created successfully:");
  console.log(admin);
}

main()
  .catch((error) => {
    console.error("Failed to create admin:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
