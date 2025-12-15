// ============================================
// PRISMA DATABASE CLIENT
// Singleton pattern to prevent multiple instances
// ============================================

// Lazy-load Prisma to allow setting env flags before the client initializes

// Extend the global type to include prisma
declare global {
  // eslint-disable-next-line no-var
  var prisma: any | undefined;
}

// Create a singleton PrismaClient instance
// In development, we use the global object to preserve the client across HMR
// In production, we create a new instance

const prismaClientSingleton = () => {
  // Ensure Prisma uses the binary engine locally when no adapter/accelerateUrl is provided.
  // Set this before requiring the client so the runtime picks it up.
  if (!process.env.PRISMA_CLIENT_ENGINE_TYPE) {
    process.env.PRISMA_CLIENT_ENGINE_TYPE = "binary";
  }

  // Dynamic import / require so the env var above is applied before Prisma initializes
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require("@prisma/client");

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
