import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const username = 'sonergokdogan-wcc';
const title = 'My Code Review Prompt';
const content = 'I want to enhance the MCP server provided by prompts.chat, to be able to save a prompt.';
const description = 'Review assistant';
const tagNames = ['coding', 'review'];

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

try {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`User not found: ${username}`);
  }

  const existing = await prisma.prompt.findFirst({
    where: {
      authorId: user.id,
      title,
      content,
      deletedAt: null,
    },
    select: {
      id: true,
      slug: true,
      createdAt: true,
    },
  });

  if (existing) {
    console.log(JSON.stringify({
      success: true,
      alreadyExisted: true,
      promptId: existing.id,
      slug: existing.slug,
      createdAt: existing.createdAt,
    }, null, 2));
    process.exit(0);
  }

  const tags = [];
  for (const name of tagNames) {
    const slug = slugify(name);
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
      select: { id: true, name: true },
    });
    tags.push(tag);
  }

  const prompt = await prisma.prompt.create({
    data: {
      title,
      slug: slugify(title),
      description,
      content,
      type: 'TEXT',
      isPrivate: false,
      authorId: user.id,
      tags: {
        create: tags.map((tag) => ({
          tag: { connect: { id: tag.id } },
        })),
      },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      createdAt: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  await prisma.promptVersion.create({
    data: {
      promptId: prompt.id,
      version: 1,
      content,
      changeNote: 'Initial version',
      createdBy: user.id,
    },
  });

  console.log(JSON.stringify({
    success: true,
    alreadyExisted: false,
    promptId: prompt.id,
    slug: prompt.slug,
    title: prompt.title,
    createdAt: prompt.createdAt,
    tags: prompt.tags.map((entry) => entry.tag.name),
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
