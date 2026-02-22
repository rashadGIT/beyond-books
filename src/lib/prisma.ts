import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Pass datasourceUrl explicitly so Prisma doesn't rely on schema env() validation.
// This is required for Amplify Gen 1 SSR where process.env isn't passed to Lambda
// at runtime — Next.js inlines the value via next.config.ts env{} at build time.
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
