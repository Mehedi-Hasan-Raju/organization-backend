import { prisma } from "../../config/prisma.js";
import type { TeamMemberStatus } from "../../../generated/prisma/client.js";

export class DepartmentServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "DepartmentServiceError";
  }
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  emailVerified: true,
};

const departmentInclude = {
  headUser: { select: userSelect },
  _count: { select: { members: true } },
};

const memberInclude = {
  user: { select: userSelect },
  department: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
};

async function ensureActiveUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  if (!user) {
    throw new DepartmentServiceError("User not found.", 404);
  }

  if (user.status !== "ACTIVE") {
    throw new DepartmentServiceError(
      "Only active users can be assigned.",
      400,
    );
  }
}

function handleDuplicate(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    throw new DepartmentServiceError(
      "A department with this name or slug, or this membership, already exists.",
      409,
    );
  }

  throw error;
}

// List departments
export async function listDepartments() {
  return prisma.department.findMany({
    include: departmentInclude,
    orderBy: { createdAt: "desc" },
  });
}

// Create department
export async function createDepartment(data: {
  name: string;
  slug: string;
  description?: string;
  headUserId?: string | null;
}) {
  const name = data.name.trim();
  const slug = data.slug.trim().toLowerCase();

  if (!name || !slug) {
    throw new DepartmentServiceError(
      "Department name and slug are required.",
      400,
    );
  }

  if (data.headUserId) {
    await ensureActiveUser(data.headUserId);
  }

  try {
    return await prisma.department.create({
      data: {
        name,
        slug,
        description: data.description?.trim() || null,
        ...(data.headUserId !== undefined
          ? { headUserId: data.headUserId }
          : {}),
      },
      include: departmentInclude,
    });
  } catch (error) {
    handleDuplicate(error);
  }
}

// Department details and members
export async function getDepartmentById(id: string) {
  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      headUser: { select: userSelect },
      members: {
        include: memberInclude,
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { members: true } },
    },
  });

  if (!department) {
    throw new DepartmentServiceError("Department not found.", 404);
  }

  return department;
}

// Update department
export async function updateDepartment(
  id: string,
  data: {
    name?: string;
    slug?: string;
    description?: string | null;
    isActive?: boolean;
    headUserId?: string | null;
  },
) {
  const existing = await prisma.department.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new DepartmentServiceError("Department not found.", 404);
  }

  if (data.headUserId) {
    await ensureActiveUser(data.headUserId);
  }

  try {
    return await prisma.department.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.slug !== undefined
          ? { slug: data.slug.trim().toLowerCase() }
          : {}),
        ...(data.description !== undefined
          ? { description: data.description?.trim() || null }
          : {}),
        ...(data.isActive !== undefined
          ? { isActive: data.isActive }
          : {}),
        ...(data.headUserId !== undefined
          ? { headUserId: data.headUserId }
          : {}),
      },
      include: departmentInclude,
    });
  } catch (error) {
    handleDuplicate(error);
  }
}

// Delete department only when it has no members
export async function deleteDepartment(id: string) {
  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      _count: { select: { members: true } },
    },
  });

  if (!department) {
    throw new DepartmentServiceError("Department not found.", 404);
  }

  if (department._count.members > 0) {
    throw new DepartmentServiceError(
      "Remove all team members before deleting this department.",
      409,
    );
  }

  return prisma.department.delete({
    where: { id },
    select: { id: true, name: true, slug: true },
  });
}

// Add a user to a department
export async function addTeamMember(
  departmentId: string,
  data: {
    userId: string;
    designation: string;
    isSupervisor?: boolean;
  },
) {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, isActive: true },
  });

  if (!department) {
    throw new DepartmentServiceError("Department not found.", 404);
  }

  if (!department.isActive) {
    throw new DepartmentServiceError(
      "Cannot add members to an inactive department.",
      400,
    );
  }

  await ensureActiveUser(data.userId);

  try {
    return await prisma.teamMember.create({
      data: {
        departmentId,
        userId: data.userId,
        designation: data.designation.trim(),
        isSupervisor: data.isSupervisor ?? false,
      },
      include: memberInclude,
    });
  } catch (error) {
    handleDuplicate(error);
  }
}

// Update a team membership
export async function updateTeamMember(
  departmentId: string,
  memberId: string,
  data: {
    designation?: string;
    isSupervisor?: boolean;
    status?: TeamMemberStatus;
  },
) {
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, departmentId },
    select: { id: true },
  });

  if (!member) {
    throw new DepartmentServiceError(
      "Team member not found in this department.",
      404,
    );
  }

  return prisma.teamMember.update({
    where: { id: memberId },
    data: {
      ...(data.designation !== undefined
        ? { designation: data.designation.trim() }
        : {}),
      ...(data.isSupervisor !== undefined
        ? { isSupervisor: data.isSupervisor }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
    include: memberInclude,
  });
}

// Remove a membership without deleting the user account
export async function removeTeamMember(
  departmentId: string,
  memberId: string,
) {
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, departmentId },
    select: { id: true },
  });

  if (!member) {
    throw new DepartmentServiceError(
      "Team member not found in this department.",
      404,
    );
  }

  return prisma.teamMember.delete({
    where: { id: memberId },
    select: { id: true, userId: true, departmentId: true },
  });
}