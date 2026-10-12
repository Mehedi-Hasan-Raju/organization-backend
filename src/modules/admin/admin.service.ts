
import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma.js";
import type {
  UserRole,
  UserStatus,
} from "../../../generated/prisma/client.js";

export class AdminServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AdminServiceError";
  }
}

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) {
  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();

  if (!name || !email) {
    throw new AdminServiceError("Name and email are required", 400);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new AdminServiceError(
      "An account with this email already exists",
      409
    );
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  try {
    return await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: data.role,
        status: "ACTIVE",
        // The user must verify ownership of their email.
        emailVerified: false,
      },
      select: safeUserSelect,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AdminServiceError(
        "An account with this email already exists",
        409
      );
    }

    throw error;
  }
}

export async function getDashboardStats() {
  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    suspendedUsers,
    verifiedUsers,
    adminUsers,
    moderatorUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "INACTIVE" } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "MODERATOR" } }),
  ]);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: inactiveUsers,
      suspended: suspendedUsers,
      emailVerified: verifiedUsers,
    },
    roles: {
      admins: adminUsers,
      moderators: moderatorUsers,
      regularUsers: totalUsers - adminUsers - moderatorUsers,
    },
  };
}

interface GetUsersOptions {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}

export async function getUsers(options: GetUsersOptions) {
  const { page, limit, search, role, status } = options;

  const where = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: safeUserSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: safeUserSelect,
  });

  if (!user) {
    throw new AdminServiceError("User not found", 404);
  }

  return user;
}

export async function updateUserRole(
  targetUserId: string,
  role: UserRole,
  actorUserId: string
) {
  if (targetUserId === actorUserId) {
    throw new AdminServiceError("You cannot change your own role", 403);
  }

  return prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, status: true },
    });

    if (!targetUser) {
      throw new AdminServiceError("User not found", 404);
    }

    if (
      targetUser.role === "ADMIN" &&
      targetUser.status === "ACTIVE" &&
      role !== "ADMIN"
    ) {
      const activeAdminCount = await tx.user.count({
        where: { role: "ADMIN", status: "ACTIVE" },
      });

      if (activeAdminCount <= 1) {
        throw new AdminServiceError(
          "Cannot remove the last active admin",
          409
        );
      }
    }

    return tx.user.update({
      where: { id: targetUserId },
      data: {
        role,
        tokenVersion: { increment: 1 },
      },
      select: safeUserSelect,
    });
  });
}

export async function updateUserStatus(
  targetUserId: string,
  status: UserStatus,
  actorUserId: string
) {
  if (targetUserId === actorUserId) {
    throw new AdminServiceError(
      "You cannot change your own account status",
      403
    );
  }

  return prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, status: true },
    });

    if (!targetUser) {
      throw new AdminServiceError("User not found", 404);
    }

    if (
      targetUser.role === "ADMIN" &&
      targetUser.status === "ACTIVE" &&
      status !== "ACTIVE"
    ) {
      const activeAdminCount = await tx.user.count({
        where: { role: "ADMIN", status: "ACTIVE" },
      });

      if (activeAdminCount <= 1) {
        throw new AdminServiceError(
          "Cannot deactivate or suspend the last active admin",
          409
        );
      }
    }

    return tx.user.update({
      where: { id: targetUserId },
      data: {
        status,
        tokenVersion: { increment: 1 },
      },
      select: safeUserSelect,
    });
  });
}
