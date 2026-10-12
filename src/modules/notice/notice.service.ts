
import { Prisma, NoticeStatus } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";

export class NoticeServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "NoticeServiceError";
    this.statusCode = statusCode;
  }
}

function createSlug(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

  return base || `notice-${Date.now()}`;
}

async function ensureUniqueSlug(
  title: string,
  excludeId?: string,
) {
  const baseSlug = createSlug(title);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.notice.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) {
      return slug;
    }

    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
}

export async function createNotice(data: {
  title: string;
  summary?: string;
  content: string;
}) {
  const slug = await ensureUniqueSlug(data.title);

  return prisma.notice.create({
    data: {
      title: data.title,
      slug,
      summary: data.summary || null,
      content: data.content,
      status: NoticeStatus.DRAFT,
    },
  });
}

export async function updateNotice(
  id: string,
  data: {
    title?: string;
    summary?: string | null;
    content?: string;
  },
) {
  const existing = await prisma.notice.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NoticeServiceError("Notice not found.", 404);
  }

  const slug =
    data.title && data.title !== existing.title
      ? await ensureUniqueSlug(data.title, id)
      : undefined;

  return prisma.notice.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(slug ? { slug } : {}),
      ...(data.summary !== undefined
        ? { summary: data.summary || null }
        : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
    },
  });
}

export async function publishNotice(id: string) {
  const notice = await prisma.notice.findUnique({
    where: { id },
  });

  if (!notice) {
    throw new NoticeServiceError("Notice not found.", 404);
  }

  return prisma.notice.update({
    where: { id },
    data: {
      status: NoticeStatus.PUBLISHED,
      publishedAt: notice.publishedAt ?? new Date(),
    },
  });
}

export async function unpublishNotice(id: string) {
  const notice = await prisma.notice.findUnique({
    where: { id },
  });

  if (!notice) {
    throw new NoticeServiceError("Notice not found.", 404);
  }

  return prisma.notice.update({
    where: { id },
    data: {
      status: NoticeStatus.DRAFT,
    },
  });
}

export async function deleteNotice(id: string) {
  const notice = await prisma.notice.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!notice) {
    throw new NoticeServiceError("Notice not found.", 404);
  }

  await prisma.notice.delete({ where: { id } });

  return { message: "Notice deleted successfully." };
}

export async function listPublicNotices(options: {
  page: number;
  limit: number;
  search?: string;
}) {
  const { page, limit, search } = options;

  const where: Prisma.NoticeWhereInput = {
    status: NoticeStatus.PUBLISHED,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { summary: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, notices] = await prisma.$transaction([
    prisma.notice.count({ where }),
    prisma.notice.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        publishedAt: true,
        createdAt: true,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    notices,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getPublicNoticeBySlug(slug: string) {
  const notice = await prisma.notice.findFirst({
    where: {
      slug,
      status: NoticeStatus.PUBLISHED,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      content: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  if (!notice) {
    throw new NoticeServiceError("Published notice not found.", 404);
  }

  return notice;
}

export async function listAdminNotices(options: {
  page: number;
  limit: number;
  search?: string;
  status?: NoticeStatus;
}) {
  const { page, limit, search, status } = options;

  const where: Prisma.NoticeWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { summary: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, notices] = await prisma.$transaction([
    prisma.notice.count({ where }),
    prisma.notice.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    notices,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getAdminNoticeById(id: string) {
  const notice = await prisma.notice.findUnique({
    where: { id },
  });

  if (!notice) {
    throw new NoticeServiceError("Notice not found.", 404);
  }

  return notice;
}
