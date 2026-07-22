import { PrismaClient } from "@prisma/client";

function ensureDatabaseUrl(): void {
  const configuredUrl = process.env.DATABASE_URL?.trim();
  if (configuredUrl && /^(postgres|postgresql):\/\//.test(configuredUrl)) return;

  const fallbackUrl = [
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_URL,
    process.env.PRISMA_DATABASE_URL,
  ].map((value) => value?.trim()).find((value): value is string => Boolean(value && /^(postgres|postgresql):\/\//.test(value)));

  if (fallbackUrl) process.env.DATABASE_URL = fallbackUrl;
}

ensureDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
