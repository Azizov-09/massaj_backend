import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../src/database/seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await seedDatabase(prisma, true);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
