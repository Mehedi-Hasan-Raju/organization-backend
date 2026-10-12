import { prisma } from "../../config/prisma.js";
import type {
  InternshipProgramStatus,
  InternshipApplicationStatus,
  
} from "../../../generated/prisma/client.js";
import { sendNotificationEmail } from "../../config/notification-email.js";

export class InternshipServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "InternshipServiceError";
  }
}

const programInclude = {
  department: {
    select: { id: true, name: true, slug: true },
  },
  _count: {
    select: { applications: true },
  },
};

const applicationInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  program: {
    select: {
      id: true,
      title: true,
      slug: true,
      department: {
        select: { id: true, name: true },
      },
    },
  },
  reviewer: {
    select: { id: true, name: true, email: true },
  },
};

function handleDuplicate(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    throw new InternshipServiceError(
      "This record already exists.",
      409,
    );
  }

  throw error;
}

async function findProgram(idOrSlug: string) {
  const program = await prisma.internshipProgram.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: programInclude,
  });

  if (!program) {
    throw new InternshipServiceError(
      "Internship program not found.",
      404,
    );
  }

  return program;
}

// ADMIN: list all programs
export async function listAllPrograms() {
  return prisma.internshipProgram.findMany({
    include: programInclude,
    orderBy: { createdAt: "desc" },
  });
}

// USER: only published programs
export async function listPublishedPrograms() {
  return prisma.internshipProgram.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ deadline: null }, { deadline: { gt: new Date() } }],
    },
    include: programInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getProgram(
  idOrSlug: string,
  admin = false,
) {
  const program = await findProgram(idOrSlug);

  if (!admin && program.status !== "PUBLISHED") {
    throw new InternshipServiceError(
      "Internship program not found.",
      404,
    );
  }

  if (
    !admin &&
    program.deadline &&
    program.deadline <= new Date()
  ) {
    throw new InternshipServiceError(
      "The application deadline has passed.",
      400,
    );
  }

  return program;
}

// ADMIN: create a program
export async function createProgram(data: {
  title: string;
  slug: string;
  description: string;
  requirements?: string;
  seats: number;
  deadline?: string | null;
  departmentId: string;
  status?: InternshipProgramStatus;
}) {
  const department = await prisma.department.findUnique({
    where: { id: data.departmentId },
    select: { id: true, isActive: true },
  });

  if (!department) {
    throw new InternshipServiceError(
      "Department not found.",
      404,
    );
  }

  if (!department.isActive) {
    throw new InternshipServiceError(
      "Cannot create a program for an inactive department.",
      400,
    );
  }

  if (data.deadline && new Date(data.deadline) <= new Date()) {
    throw new InternshipServiceError(
      "Deadline must be in the future.",
      400,
    );
  }

  const status = data.status ?? "DRAFT";

  try {
    return await prisma.internshipProgram.create({
      data: {
        title: data.title.trim(),
        slug: data.slug.trim().toLowerCase(),
        description: data.description.trim(),
        requirements: data.requirements?.trim() || null,
        seats: data.seats,
        deadline: data.deadline ? new Date(data.deadline) : null,
        departmentId: data.departmentId,
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      },
      include: programInclude,
    });
  } catch (error) {
    handleDuplicate(error);
  }
}

// ADMIN: update a program
export async function updateProgram(
  idOrSlug: string,
  data: {
    title?: string;
    slug?: string;
    description?: string;
    requirements?: string | null;
    seats?: number;
    deadline?: string | null;
    departmentId?: string;
    status?: InternshipProgramStatus;
  },
) {
  const existing = await findProgram(idOrSlug);

  if (data.departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: data.departmentId },
      select: { id: true, isActive: true },
    });

    if (!department) {
      throw new InternshipServiceError(
        "Department not found.",
        404,
      );
    }

    if (!department.isActive) {
      throw new InternshipServiceError(
        "Cannot assign a program to an inactive department.",
        400,
      );
    }
  }

  if (data.deadline && new Date(data.deadline) <= new Date()) {
    throw new InternshipServiceError(
      "Deadline must be in the future.",
      400,
    );
  }

  const nextStatus = data.status ?? existing.status;

  try {
    return await prisma.internshipProgram.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined
          ? { title: data.title.trim() }
          : {}),
        ...(data.slug !== undefined
          ? { slug: data.slug.trim().toLowerCase() }
          : {}),
        ...(data.description !== undefined
          ? { description: data.description.trim() }
          : {}),
        ...(data.requirements !== undefined
          ? { requirements: data.requirements?.trim() || null }
          : {}),
        ...(data.seats !== undefined
          ? { seats: data.seats }
          : {}),
        ...(data.deadline !== undefined
          ? {
              deadline: data.deadline
                ? new Date(data.deadline)
                : null,
            }
          : {}),
        ...(data.departmentId !== undefined
          ? { departmentId: data.departmentId }
          : {}),
        ...(data.status !== undefined
          ? {
              status: data.status,
              publishedAt:
                data.status === "PUBLISHED"
                  ? existing.publishedAt ?? new Date()
                  : existing.publishedAt,
            }
          : {}),
      },
      include: programInclude,
    });
  } catch (error) {
    handleDuplicate(error);
  }
}

// ADMIN: delete only programs without applications
export async function deleteProgram(idOrSlug: string) {
  const program = await findProgram(idOrSlug);

  if (program._count.applications > 0) {
    throw new InternshipServiceError(
      "This program has applications and cannot be deleted.",
      409,
    );
  }

  return prisma.internshipProgram.delete({
    where: { id: program.id },
    select: { id: true, title: true, slug: true },
  });
}

// USER: apply for a published program
export async function applyForProgram(
  userId: string,
  idOrSlug: string,
  data: {
    cvUrl?: string;
    coverLetter?: string;
  },
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      emailVerified: true,
    },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new InternshipServiceError(
      "An active user account is required.",
      403,
    );
  }

  if (!user.emailVerified) {
    throw new InternshipServiceError(
      "Verify your email before applying.",
      403,
    );
  }

  const program = await findProgram(idOrSlug);

  if (program.status !== "PUBLISHED") {
    throw new InternshipServiceError(
      "This program is not accepting applications.",
      400,
    );
  }

  if (program.deadline && program.deadline <= new Date()) {
    throw new InternshipServiceError(
      "The application deadline has passed.",
      400,
    );
  }

  const selectedCount = await prisma.internshipApplication.count({
    where: {
      programId: program.id,
      status: "SELECTED",
    },
  });

  if (selectedCount >= program.seats) {
    throw new InternshipServiceError(
      "All available seats have been filled.",
      400,
    );
  }

  try {
    
const application = await prisma.internshipApplication.create({
  data: {
    userId,
    programId: program.id,
    cvUrl: data.cvUrl?.trim() || null,
    coverLetter: data.coverLetter?.trim() || null,
  },
  include: applicationInclude,
});

try {
  await sendNotificationEmail(
    application.user.email,
    `YSSE Application Received: ${program.title}`,
    [
      `Hello ${application.user.name},`,
      "",
      `We have received your application for "${program.title}".`,
      `Current status: ${application.status}`,
      "",
      "The YSSE team will review your application and notify you about updates.",
    ].join("\n"),
  );
} catch (error) {
  console.error("YSSE application confirmation email failed:", error);
}

return application;

  } catch (error) {
    handleDuplicate(error);
  }
}

// USER: view own applications
export async function listMyApplications(userId: string) {
  return prisma.internshipApplication.findMany({
    where: { userId },
    include: applicationInclude,
    orderBy: { appliedAt: "desc" },
  });
}


export async function listApplications(options: {
  page: number;
  limit: number;
  search?: string;
  programId?: string;
  status?: InternshipApplicationStatus;
}) {
  const { page, limit, search, programId, status } = options;

  const where = {
    ...(programId ? { programId } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            {
              user: {
                is: {
                  name: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
            {
              user: {
                is: {
                  email: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
            {
              program: {
                is: {
                  title: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [total, applications] = await prisma.$transaction([
    prisma.internshipApplication.count({ where }),
    prisma.internshipApplication.findMany({
      where,
      include: applicationInclude,
      orderBy: { appliedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: applications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}
// ADMIN: review an application
export async function reviewApplication(
  applicationId: string,
  reviewerId: string,
  data: {
    status: InternshipApplicationStatus;
    adminNote?: string | null;
  },
) {
  const application = await prisma.internshipApplication.findUnique({
    where: { id: applicationId },
    include: {
      program: {
        select: { id: true, seats: true },
      },
    },
  });

  if (!application) {
    throw new InternshipServiceError(
      "Application not found.",
      404,
    );
  }

  if (application.status === "WITHDRAWN") {
    throw new InternshipServiceError(
      "Withdrawn applications cannot be reviewed.",
      400,
    );
  }

  if (data.status === "SELECTED") {
    const selectedCount = await prisma.internshipApplication.count({
      where: {
        programId: application.programId,
        status: "SELECTED",
        id: { not: applicationId },
      },
    });

    if (selectedCount >= application.program.seats) {
      throw new InternshipServiceError(
        "All available seats have been filled.",
        409,
      );
    }
  }

 
const updated = await prisma.internshipApplication.update({
  where: { id: applicationId },
  data: {
    status: data.status,
    reviewerId,
    ...(data.adminNote !== undefined
      ? { adminNote: data.adminNote?.trim() || null }
      : {}),
  },
  include: applicationInclude,
});

try {
  await sendNotificationEmail(
    updated.user.email,
    `YSSE Application Update: ${updated.program.title}`,
    [
      `Hello ${updated.user.name},`,
      "",
      `Your application for "${updated.program.title}" has been reviewed.`,
      `Updated status: ${updated.status}`,
      ...(updated.adminNote ? [`Admin note: ${updated.adminNote}`] : []),
      "",
      "Please log in to your account to check your application details.",
    ].join("\n"),
  );
} catch (error) {
  console.error("YSSE application status email failed:", error);
}

return updated;

}