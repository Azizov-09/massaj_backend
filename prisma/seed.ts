import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../src/database/seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const summary = await seedDatabase(prisma);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
