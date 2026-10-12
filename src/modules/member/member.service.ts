
import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";

export class MemberServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "MemberServiceError";
    this.statusCode = statusCode;
  }
}

const memberInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      emailVerified: true,
      createdAt: true,
    },
  },
  department: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} satisfies Prisma.TeamMemberInclude;

export async function listMembers(options: {
  page: number;
  limit: number;
  search?: string;
  departmentId?: string;
  status?: "ACTIVE" | "INACTIVE";
}) {
  const { page, limit, search, departmentId, status } = options;

  const where: Prisma.TeamMemberWhereInput = {
    ...(departmentId ? { departmentId } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            {
              user: {
                name: { contains: search, mode: "insensitive" },
              },
            },
            {
              user: {
                email: { contains: search, mode: "insensitive" },
              },
            },
            {
              department: {
                name: { contains: search, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };

  const [total, members] = await prisma.$transaction([
    prisma.teamMember.count({ where }),
    prisma.teamMember.findMany({
      where,
      include: memberInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    members,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getMemberById(id: string) {
  const member = await prisma.teamMember.findUnique({
    where: { id },
    include: memberInclude,
  });

  if (!member) {
    throw new MemberServiceError("Member not found.", 404);
  }

  return member;
}

export async function addMember(data: {
  userId: string;
  departmentId: string;
  designation: string;
  isSupervisor?: boolean;
}) {
  const [user, department] = await Promise.all([
    prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, status: true },
    }),
    prisma.department.findUnique({
      where: { id: data.departmentId },
      select: { id: true, isActive: true },
    }),
  ]);

  if (!user) {
    throw new MemberServiceError("User not found.", 404);
  }

  if (user.status !== "ACTIVE") {
    throw new MemberServiceError(
      "An inactive or suspended user cannot be added as a member.",
      400,
    );
  }

  if (!department) {
    throw new MemberServiceError("Department not found.", 404);
  }

  if (!department.isActive) {
    throw new MemberServiceError(
      "Cannot add members to an inactive department.",
      400,
    );
  }

  const trimmedDesignation = data.designation.trim();

  if (!trimmedDesignation) {
    throw new MemberServiceError("Designation is required.", 400);
  }

  try {
    return await prisma.teamMember.create({
      data: {
        userId: data.userId,
        departmentId: data.departmentId,
        designation: trimmedDesignation,
        isSupervisor: data.isSupervisor ?? false,
      },
      include: memberInclude,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new MemberServiceError(
        "This user is already a member of this department.",
        409,
      );
    }

    throw error;
  }
}

export async function updateMemberStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE",
) {
  const existing = await prisma.teamMember.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new MemberServiceError("Member not found.", 404);
  }

  return prisma.teamMember.update({
    where: { id },
    data: { status },
    include: memberInclude,
  });
}

export async function removeMember(id: string) {
  const existing = await prisma.teamMember.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new MemberServiceError("Member not found.", 404);
  }

  await prisma.teamMember.delete({ where: { id } });

  return { message: "Member removed successfully." };
}
