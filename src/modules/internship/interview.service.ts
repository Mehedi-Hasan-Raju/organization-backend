
import { prisma } from "../../config/prisma.js";
import { sendNotificationEmail } from "../../config/notification-email.js";
import { InternshipServiceError } from "./internship.service.js";

import type {
  InternshipInterviewStatus,
} from "../../../generated/prisma/client.js";

const interviewInclude = {
  interviewer: {
    select: { id: true, name: true, email: true },
  },
  application: {
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      program: {
        select: { id: true, title: true, slug: true },
      },
    },
  },
};

type InterviewInput = {
  scheduledAt: string;
  durationMinutes?: number;
  meetingUrl?: string;
  location?: string;
  notes?: string;
};

async function notifyApplicant(
  to: string,
  subject: string,
  message: string,
) {
  try {
    await sendNotificationEmail(to, subject, message);
  } catch (error) {
    // Database operation has already succeeded. Do not fail the API
    // response just because email delivery failed.
    console.error("YSSE interview email notification failed:", error);
  }
}

function formatInterviewDate(date: Date): string {
  return date.toLocaleString("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }) + " (Bangladesh time)";
}

export async function scheduleInterview(
  applicationId: string,
  interviewerId: string,
  data: InterviewInput,
) {
  const scheduledAt = new Date(data.scheduledAt);

  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    throw new InternshipServiceError(
      "Interview date and time must be in the future.",
      400,
    );
  }

  const application = await prisma.internshipApplication.findUnique({
    where: { id: applicationId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      program: { select: { id: true, title: true } },
    },
  });

  if (!application) {
    throw new InternshipServiceError("Application not found.", 404);
  }

  if (
    application.status === "REJECTED" ||
    application.status === "WITHDRAWN"
  ) {
    throw new InternshipServiceError(
      "An interview cannot be scheduled for a rejected or withdrawn application.",
      400,
    );
  }

  const interview = await prisma.$transaction(async (tx) => {
    const createdInterview = await tx.internshipInterview.create({
      data: {
        applicationId,
        interviewerId,
        scheduledAt,
        durationMinutes: data.durationMinutes ?? 30,
        meetingUrl: data.meetingUrl?.trim() || null,
        location: data.location?.trim() || null,
        notes: data.notes?.trim() || null,
        status: "SCHEDULED",
      },
      include: interviewInclude,
    });

    await tx.internshipApplication.update({
      where: { id: applicationId },
      data: { status: "INTERVIEW" },
    });

    return createdInterview;
  });

  await notifyApplicant(
    application.user.email,
    `YSSE Interview Scheduled: ${application.program.title}`,
    [
      `Hello ${application.user.name},`,
      "",
      `Your interview for "${application.program.title}" has been scheduled.`,
      `Date and time: ${formatInterviewDate(scheduledAt)}`,
      `Duration: ${interview.durationMinutes} minutes`,
      `Meeting URL: ${interview.meetingUrl ?? "Not provided"}`,
      `Location: ${interview.location ?? "Not provided"}`,
      `Notes: ${interview.notes ?? "No additional notes"}`,
      "",
      "Please contact YSSE if you need assistance.",
    ].join("\n"),
  );

  return interview;
}

export async function updateInterview(
  interviewId: string,
  data: {
    scheduledAt?: string;
    durationMinutes?: number;
    meetingUrl?: string | null;
    location?: string | null;
    notes?: string | null;
    status?: InternshipInterviewStatus;
  },
) {
  const existing = await prisma.internshipInterview.findUnique({
    where: { id: interviewId },
    include: interviewInclude,
  });

  if (!existing) {
    throw new InternshipServiceError("Interview not found.", 404);
  }

  if (existing.status === "CANCELLED") {
    throw new InternshipServiceError(
      "A cancelled interview cannot be updated.",
      400,
    );
  }

  if (data.scheduledAt !== undefined) {
    const date = new Date(data.scheduledAt);

    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      throw new InternshipServiceError(
        "Interview date and time must be in the future.",
        400,
      );
    }
  }

  const updated = await prisma.internshipInterview.update({
    where: { id: interviewId },
    data: {
      ...(data.scheduledAt !== undefined
        ? { scheduledAt: new Date(data.scheduledAt) }
        : {}),
      ...(data.durationMinutes !== undefined
        ? { durationMinutes: data.durationMinutes }
        : {}),
      ...(data.meetingUrl !== undefined
        ? { meetingUrl: data.meetingUrl?.trim() || null }
        : {}),
      ...(data.location !== undefined
        ? { location: data.location?.trim() || null }
        : {}),
      ...(data.notes !== undefined
        ? { notes: data.notes?.trim() || null }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
    include: interviewInclude,
  });

  const changed =
    data.scheduledAt !== undefined ||
    data.durationMinutes !== undefined ||
    data.meetingUrl !== undefined ||
    data.location !== undefined ||
    data.notes !== undefined;

  if (changed) {
    await notifyApplicant(
      existing.application.user.email,
      `YSSE Interview Updated: ${existing.application.program.title}`,
      [
        `Hello ${existing.application.user.name},`,
        "",
        `Your interview for "${existing.application.program.title}" has been updated.`,
        `Date and time: ${formatInterviewDate(updated.scheduledAt)}`,
        `Duration: ${updated.durationMinutes} minutes`,
        `Meeting URL: ${updated.meetingUrl ?? "Not provided"}`,
        `Location: ${updated.location ?? "Not provided"}`,
        `Notes: ${updated.notes ?? "No additional notes"}`,
      ].join("\n"),
    );
  }

  return updated;
}

export async function cancelInterview(interviewId: string) {
  const existing = await prisma.internshipInterview.findUnique({
    where: { id: interviewId },
    include: interviewInclude,
  });

  if (!existing) {
    throw new InternshipServiceError("Interview not found.", 404);
  }

  if (existing.status === "CANCELLED") {
    throw new InternshipServiceError(
      "This interview is already cancelled.",
      400,
    );
  }

  const cancelled = await prisma.internshipInterview.update({
    where: { id: interviewId },
    data: { status: "CANCELLED" },
    include: interviewInclude,
  });

  await notifyApplicant(
    existing.application.user.email,
    `YSSE Interview Cancelled: ${existing.application.program.title}`,
    [
      `Hello ${existing.application.user.name},`,
      "",
      `Your interview for "${existing.application.program.title}" has been cancelled.`,
      `Previously scheduled for: ${formatInterviewDate(existing.scheduledAt)}`,
      "",
      "YSSE will contact you if a new interview is arranged.",
    ].join("\n"),
  );

  return cancelled;
}
