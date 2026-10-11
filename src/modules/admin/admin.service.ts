
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

export async function updateUserRole(
  targetUserId: string,
  role: UserRole,
  actorUserId: string
) {
  if (targetUserId === actorUserId) {
    throw new AdminServiceError(
      "You cannot change your own role",
      403
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });

  if (!targetUser) {
    throw new AdminServiceError("User not found", 404);
  }

  return prisma.user.update({
    where: { id: targetUserId },
    data: { role },
    select: safeUserSelect,
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

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });

  if (!targetUser) {
    throw new AdminServiceError("User not found", 404);
  }

  return prisma.user.update({
    where: { id: targetUserId },
    data: { status },
    select: safeUserSelect,
  });
}
