import "dotenv/config";

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { prisma } from "../../src/config/prisma.ts";
import authRouter from "../../src/auth/auth.routes.ts";

const userId = "change-password-test-user";
const originalJwtSecret = process.env.JWT_SECRET;
const testJwtSecret = "change-password-test-secret";
const originalFindUnique = prisma.user.findUnique;
const originalUpdate = prisma.user.update;
let server;
let serverUrl;
let storedPasswordHash;

function authorizationHeader() {
  const token = jwt.sign(
    { role: "USER", tokenVersion: 0 },
    testJwtSecret,
    { subject: userId },
  );

  return `Bearer ${token}`;
}

async function postChangePassword(body, authenticated = true) {
  const response = await fetch(`${serverUrl}/change-password`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authenticated ? { authorization: authorizationHeader() } : {}),
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

describe("POST /api/v1/auth/change-password", () => {
  before(async () => {
    process.env.JWT_SECRET = testJwtSecret;
    storedPasswordHash = await bcrypt.hash("old-password", 12);

    prisma.user.findUnique = async (args) => {
      if (args.select?.passwordHash) {
        return { passwordHash: storedPasswordHash };
      }

      return {
        id: userId,
        role: "USER",
        status: "ACTIVE",
        tokenVersion: 0,
      };
    };

    prisma.user.update = async ({ data }) => {
      storedPasswordHash = data.passwordHash;
      return {};
    };

    const app = express();
    app.use(express.json());
    app.use("/api/v1/auth", authRouter);
    server = createServer(app);
    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    assert.ok(address && typeof address !== "string");
    serverUrl = `http://127.0.0.1:${address.port}/api/v1/auth`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    prisma.user.findUnique = originalFindUnique;
    prisma.user.update = originalUpdate;

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it("changes the password when the current password is valid", async () => {
    const result = await postChangePassword({
      currentPassword: "old-password",
      newPassword: "new-password",
    });

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      success: true,
      message: "Password changed successfully.",
    });
    assert.equal(await bcrypt.compare("new-password", storedPasswordHash), true);
  });

  it("rejects an incorrect current password", async () => {
    const result = await postChangePassword({
      currentPassword: "incorrect-password",
      newPassword: "another-password",
    });

    assert.equal(result.status, 400);
    assert.equal(result.body.success, false);
    assert.equal(result.body.message, "Current password is incorrect.");
  });

  it("rejects a new password outside the allowed length", async () => {
    const result = await postChangePassword({
      currentPassword: "old-password",
      newPassword: "short",
    });

    assert.equal(result.status, 400);
    assert.equal(result.body.success, false);
    assert.equal(result.body.message, "Validation failed");
  });

  it("rejects unauthenticated requests", async () => {
    const result = await postChangePassword({
      currentPassword: "old-password",
      newPassword: "new-password",
    }, false);

    assert.equal(result.status, 401);
    assert.equal(result.body.success, false);
  });
});
