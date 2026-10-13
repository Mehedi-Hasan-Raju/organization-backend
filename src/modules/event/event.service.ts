
import { EventStatus, Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";

export class EventServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "EventServiceError";
  }
}

function makeSlug(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || `event-${Date.now()}`;
}

function validateDates(startDate: Date, endDate?: Date | null) {
  if (Number.isNaN(startDate.getTime())) {
    throw new EventServiceError("Invalid event start date.");
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new EventServiceError("Invalid event end date.");
  }

  if (endDate && endDate < startDate) {
    throw new EventServiceError(
      "Event end date cannot be before its start date.",
    );
  }
}

export async function createEvent(
  createdById: string,
  input: {
    title: string;
    summary?: string;
    description: string;
    location?: string;
    startDate: string;
    endDate?: string;
    imageUrl?: string;
    imagePublicId?: string;
  },
) {
  const title = input.title?.trim();
  const description = input.description?.trim();

  if (!title || !description || !input.startDate) {
    throw new EventServiceError(
      "Title, description and startDate are required.",
    );
  }

  const startDate = new Date(input.startDate);
  const endDate = input.endDate ? new Date(input.endDate) : null;

  validateDates(startDate, endDate);

  const baseSlug = makeSlug(title);
  let slug = baseSlug;
  let counter = 1;

  while (await prisma.event.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  return prisma.event.create({
    data: {
      title,
      slug,
      summary: input.summary?.trim() || null,
      description,
      location: input.location?.trim() || null,
      startDate,
      endDate,
      imageUrl: input.imageUrl || null,
      imagePublicId: input.imagePublicId || null,
      createdById,
    },
  });
}

export async function getPublicEvents(query: {
  page?: number;
  limit?: number;
  type?: string;
}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
  const now = new Date();

  const dateFilter: Prisma.EventWhereInput =
    query.type === "past"
      ? { startDate: { lt: now } }
      : query.type === "upcoming"
        ? { startDate: { gte: now } }
        : {};

  const where: Prisma.EventWhereInput = {
    status: EventStatus.PUBLISHED,
    ...dateFilter,
  };

  const [events, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      orderBy: { startDate: query.type === "past" ? "desc" : "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  return {
    events,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getPublicEventBySlug(slug: string) {
  const event = await prisma.event.findFirst({
    where: { slug, status: EventStatus.PUBLISHED },
  });

  if (!event) {
    throw new EventServiceError("Event not found.", 404);
  }

  return event;
}

export async function getManagedEvents(query: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

  const where: Prisma.EventWhereInput = {
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { location: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.status &&
    Object.values(EventStatus).includes(query.status as EventStatus)
      ? { status: query.status as EventStatus }
      : {}),
  };

  const [events, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  return {
    events,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getManagedEventById(id: string) {
  const event = await prisma.event.findUnique({ where: { id } });

  if (!event) throw new EventServiceError("Event not found.", 404);
  return event;
}

export async function updateEvent(
  id: string,
  input: {
    title?: string;
    summary?: string | null;
    description?: string;
    location?: string | null;
    startDate?: string;
    endDate?: string | null;
    imageUrl?: string | null;
    imagePublicId?: string | null;
  },
) {
  const existing = await getManagedEventById(id);

  const startDate =
    input.startDate !== undefined
      ? new Date(input.startDate)
      : existing.startDate;

  const endDate =
    input.endDate !== undefined
      ? input.endDate
        ? new Date(input.endDate)
        : null
      : existing.endDate;

  validateDates(startDate, endDate);

  let slug = existing.slug;

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new EventServiceError("Title cannot be empty.");

    const baseSlug = makeSlug(title);
    slug = baseSlug;
    let counter = 1;

    while (true) {
      const duplicate = await prisma.event.findUnique({ where: { slug } });
      if (!duplicate || duplicate.id === id) break;
      slug = `${baseSlug}-${counter++}`;
    }
  }

  return prisma.event.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim(), slug } : {}),
      ...(input.summary !== undefined ? { summary: input.summary?.trim() || null } : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim() }
        : {}),
      ...(input.location !== undefined
        ? { location: input.location?.trim() || null }
        : {}),
      ...(input.startDate !== undefined || input.endDate !== undefined
        ? { startDate, endDate }
        : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.imagePublicId !== undefined
        ? { imagePublicId: input.imagePublicId }
        : {}),
    },
  });
}

export async function publishEvent(id: string) {
  await getManagedEventById(id);

  return prisma.event.update({
    where: { id },
    data: {
      status: EventStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });
}

export async function unpublishEvent(id: string) {
  await getManagedEventById(id);

  return prisma.event.update({
    where: { id },
    data: {
      status: EventStatus.DRAFT,
      publishedAt: null,
    },
  });
}

export async function archiveEvent(id: string) {
  await getManagedEventById(id);

  return prisma.event.update({
    where: { id },
    data: { status: EventStatus.ARCHIVED },
  });
}

export async function deleteEvent(id: string) {
  await getManagedEventById(id);

  return prisma.event.delete({ where: { id } });
}
