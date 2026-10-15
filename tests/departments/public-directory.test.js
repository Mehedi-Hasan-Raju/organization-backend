import "dotenv/config";

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

import { prisma } from "../../src/config/prisma.ts";
import departmentRouter from "../../src/modules/department/department.routes.ts";
import { getHomepageData } from "../../src/modules/homepage/homepage.service.ts";

const testJwtSecret = "department-directory-test-secret";
const originalJwtSecret = process.env.JWT_SECRET;
const userId = "department-directory-test-user";
const originalMethods = {
  departmentFindMany: prisma.department.findMany,
  departmentFindFirst: prisma.department.findFirst,
  departmentCount: prisma.department.count,
  userFindUnique: prisma.user.findUnique,
  userCount: prisma.user.count,
  teamMemberFindMany: prisma.teamMember.findMany,
  internshipCount: prisma.internshipProgram.count,
  internshipFindMany: prisma.internshipProgram.findMany,
  courseCount: prisma.course.count,
  courseFindMany: prisma.course.findMany,
  noticeFindMany: prisma.notice.findMany,
  eventFindMany: prisma.event.findMany,
};

const department = {
  id: "department-1",
  slug: "engineering",
  name: "Engineering",
  description: "Builds products",
  isActive: true,
  headUser: {
    name: "Department Head",
    avatarUrl: "https://example.com/head.png",
    email: "head@example.com",
    passwordHash: "private-hash",
    role: "ADMIN",
  },
  members: [
    {
      id: "membership-1",
      designation: "Engineer",
      isSupervisor: false,
      status: "ACTIVE",
      user: {
        name: "Team Member",
        avatarUrl: null,
        email: "member@example.com",
        passwordHash: "private-hash",
        role: "USER",
      },
    },
    {
      id: "membership-inactive",
      designation: "Former Engineer",
      isSupervisor: false,
      status: "INACTIVE",
      user: {
        name: "Former Member",
        avatarUrl: null,
      },
    },
  ],
  _count: { members: 1 },
};

let server;
let baseUrl;
let lastDepartmentFindManyArgs;
let lastDepartmentFindFirstArgs;

function authorizationHeader(role = "USER") {
  const token = jwt.sign(
    { role, tokenVersion: 0 },
    testJwtSecret,
    { subject: userId },
  );
  return `Bearer ${token}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { status: response.status, body: await response.json() };
}

describe("public department directory", () => {
  before(async () => {
    process.env.JWT_SECRET = testJwtSecret;

    prisma.department.findMany = async (args) => {
      lastDepartmentFindManyArgs = args;
      return [{
        id: department.id,
        slug: department.slug,
        name: department.name,
        description: department.description,
        isActive: true,
        _count: { members: 1 },
      }];
    };
    prisma.department.findFirst = async (args) => {
      lastDepartmentFindFirstArgs = args;
      if (!args.where.OR.some((condition) =>
        condition.id === department.id ||
        condition.slug === department.slug
      )) {
        return null;
      }
      return {
        id: department.id,
        slug: department.slug,
        name: department.name,
        description: department.description,
        isActive: department.isActive,
        _count: department._count,
        headUser: {
          name: department.headUser.name,
          avatarUrl: department.headUser.avatarUrl,
        },
        members: department.members
          .filter((member) =>
            member.status === args.select.members.where.status
          )
          .map(({ id, designation, isSupervisor, status, user }) => ({
            id,
            designation,
            isSupervisor,
            status,
            user: { name: user.name, avatarUrl: user.avatarUrl },
          })),
      };
    };
    prisma.department.count = async () => 1;
    prisma.user.findUnique = async (args) => {
      if (args.select?.role) {
        return {
          id: userId,
          role: "USER",
          status: "ACTIVE",
          tokenVersion: 0,
        };
      }
      return null;
    };

    prisma.user.count = async () => 0;
    prisma.teamMember.findMany = async () => [];
    prisma.internshipProgram.count = async () => 0;
    prisma.internshipProgram.findMany = async () => [];
    prisma.course.count = async () => 0;
    prisma.course.findMany = async () => [];
    prisma.notice.findMany = async () => [];
    prisma.event.findMany = async () => [];

    const app = express();
    app.use(express.json());
    app.use("/api/v1/departments", departmentRouter);
    server = createServer(app);

    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}/api/v1/departments`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });

    prisma.department.findMany = originalMethods.departmentFindMany;
    prisma.department.findFirst = originalMethods.departmentFindFirst;
    prisma.department.count = originalMethods.departmentCount;
    prisma.user.findUnique = originalMethods.userFindUnique;
    prisma.user.count = originalMethods.userCount;
    prisma.teamMember.findMany = originalMethods.teamMemberFindMany;
    prisma.internshipProgram.count = originalMethods.internshipCount;
    prisma.internshipProgram.findMany = originalMethods.internshipFindMany;
    prisma.course.count = originalMethods.courseCount;
    prisma.course.findMany = originalMethods.courseFindMany;
    prisma.notice.findMany = originalMethods.noticeFindMany;
    prisma.event.findMany = originalMethods.eventFindMany;

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it("returns the active department directory without authentication", async () => {
    const result = await request("/");

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      success: true,
      data: [{
        id: department.id,
        slug: department.slug,
        name: department.name,
        description: department.description,
        isActive: true,
        _count: { members: 1 },
      }],
    });
    assert.deepEqual(lastDepartmentFindManyArgs.where, { isActive: true });
    assert.deepEqual(
      lastDepartmentFindManyArgs.select._count.select.members.where,
      { status: "ACTIVE" },
    );
  });

  it("returns safe detail fields by department id", async () => {
    const result = await request(`/${department.id}`);

    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data, {
      id: department.id,
      slug: department.slug,
      name: department.name,
      description: department.description,
      isActive: true,
      _count: { members: 1 },
      headUser: {
        name: "Department Head",
        avatarUrl: "https://example.com/head.png",
      },
      members: [{
        id: "membership-1",
        designation: "Engineer",
        isSupervisor: false,
        status: "ACTIVE",
        user: { name: "Team Member", avatarUrl: null },
      }],
    });
    assert.deepEqual(lastDepartmentFindFirstArgs.where, {
      isActive: true,
      OR: [{ id: department.id }, { slug: department.id }],
    });
    assert.deepEqual(
      lastDepartmentFindFirstArgs.select.headUser.select,
      { name: true, avatarUrl: true },
    );
    assert.deepEqual(
      lastDepartmentFindFirstArgs.select.members.where,
      { status: "ACTIVE" },
    );
    assert.deepEqual(
      lastDepartmentFindFirstArgs.select.members.select.user.select,
      { name: true, avatarUrl: true },
    );

    const serialized = JSON.stringify(result.body);
    for (const sensitiveField of ["email", "passwordHash", "role", "emailVerified"]) {
      assert.equal(serialized.includes(sensitiveField), false);
    }
    assert.equal(
      result.body.data.members.some((member) => member.status !== "ACTIVE"),
      false,
    );
  });

  it("looks up department detail by slug", async () => {
    const result = await request(`/${department.slug}`);

    assert.equal(result.status, 200);
    assert.equal(result.body.data.id, department.id);
    assert.deepEqual(lastDepartmentFindFirstArgs.where.OR, [
      { id: department.slug },
      { slug: department.slug },
    ]);
  });

  it("hides inactive departments", async () => {
    prisma.department.findFirst = async (args) => {
      lastDepartmentFindFirstArgs = args;
      return null;
    };

    const result = await request("/inactive-department");

    assert.equal(result.status, 404);
    assert.equal(result.body.success, false);
    assert.equal(lastDepartmentFindFirstArgs.where.isActive, true);
  });

  it("keeps department create and team-member management protected", async () => {
    for (const [path, method] of [
      ["/", "POST"],
      ["/department-1", "PATCH"],
      ["/department-1", "DELETE"],
      ["/department-1/members", "POST"],
      ["/department-1/members/member-1", "PATCH"],
      ["/department-1/members/member-1", "DELETE"],
    ]) {
      const result = await request(path, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" || method === "PATCH" ? "{}" : undefined,
      });
      assert.equal(result.status, 401, `${method} ${path} should require auth`);
    }

    const member = await request("/department-1/members", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: authorizationHeader(),
      },
      body: JSON.stringify({
        userId: "new-member",
        designation: "Engineer",
      }),
    });
    assert.equal(member.status, 403);
  });

  it("includes active departments in homepage data", async () => {
    prisma.department.findMany = async (args) => {
      lastDepartmentFindManyArgs = args;
      return [{
        id: department.id,
        slug: department.slug,
        name: department.name,
        description: department.description,
        _count: { members: 1 },
      }];
    };

    const result = await getHomepageData();

    assert.deepEqual(result.departments, [{
      id: department.id,
      slug: department.slug,
      name: department.name,
      description: department.description,
      _count: { members: 1 },
    }]);
    assert.deepEqual(lastDepartmentFindManyArgs.where, { isActive: true });
    assert.deepEqual(
      lastDepartmentFindManyArgs.select._count.select.members.where,
      { status: "ACTIVE" },
    );
  });
});
