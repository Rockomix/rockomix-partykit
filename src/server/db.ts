import { type Prisma, PrismaClient } from "@prisma/client";

import { env } from "~/env";
import { sqids } from "./utils/sqids";

const createPrismaClient = () =>
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

const prisma = globalForPrisma.prisma ?? createPrismaClient();

const db = prisma.$extends({
  model: {
    party: {
      async createWithHash(args: Prisma.PartyCreateInput) {
        return await prisma.$transaction(async (tx) => {
          const party = await tx.party.create({ data: args });

          const hash = sqids.encode([party.id]);

          return await tx.party.update({
            where: { id: party.id },
            data: { hash },
          });
        });
      },
    },
  },
});

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { db };
