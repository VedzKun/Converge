// ============================================
// PRISMA DATABASE CLIENT
// Singleton pattern to prevent multiple instances
// ============================================

import { PrismaClient } from "@prisma/client";

// Extend the global type to include prisma
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create a singleton PrismaClient instance
// In development, we use the global object to preserve the client across HMR
// In production, we create a new instance

const prismaClientSingleton = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
};

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export default prisma;
