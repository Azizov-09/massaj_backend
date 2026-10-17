import { Logger } from '@nestjs/common';
import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { normalizeUzbekPhone } from '../common/utils/phone.util';

/**
 * Ensures that a Super Admin account exists in the database whenever the backend starts up.
 * Reads credentials from environment variables (SUPER_ADMIN_PHONE, SUPER_ADMIN_PASSWORD, etc.).
 */
export async function seedSuperAdmin(prisma: PrismaClient): Promise<void> {
  const logger = new Logger('SuperAdminSeed');

  const rawPhone = process.env.SUPER_ADMIN_PHONE;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const fullName = process.env.SUPER_ADMIN_FULL_NAME;
  const email = process.env.SUPER_ADMIN_EMAIL;

  if (!rawPhone || !password || !fullName) {
    logger.log('Super Admin bootstrap credentials are not configured; automatic bootstrap skipped.');
    return;
  }

  let phone: string;
  try {
    phone = normalizeUzbekPhone(rawPhone);
  } catch {
    logger.error(
      `SUPER_ADMIN_PHONE invalid format: "${rawPhone}". Expected Uzbek format (+998XXXXXXXXX)`,
    );
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: { phone },
    include: { admin: true },
  });

  if (!existingUser) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    logger.log(`Creating initial Super Admin with phone: ${phone}...`);
    await prisma.user.create({
      data: {
        fullName,
        phone,
        email,
        passwordHash,
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        admin: {
          create: {},
        },
      },
    });
    logger.log(`Initial Super Admin created successfully (${phone})`);
  } else if (existingUser.role !== Role.SUPER_ADMIN || !existingUser.admin) {
    throw new Error('Configured SUPER_ADMIN_PHONE belongs to an account that is not a complete SUPER_ADMIN profile');
  } else {
    logger.log(`Super Admin already exists (${phone}); credentials were left unchanged.`);
  }
}
