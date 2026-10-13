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

  const rawPhone = process.env.SUPER_ADMIN_PHONE ?? '+998901000001';
  const password = process.env.SUPER_ADMIN_PASSWORD ?? 'Admin123!';
  const fullName = process.env.SUPER_ADMIN_FULL_NAME ?? 'Bosh Administrator (Super)';
  const email = process.env.SUPER_ADMIN_EMAIL ?? 'admin@massaj.uz';

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

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  if (!existingUser) {
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
  } else {
    logger.log(
      `Super Admin already exists (${phone}). Ensuring credentials & SUPER_ADMIN role...`,
    );
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        fullName,
        email,
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    if (!existingUser.admin) {
      await prisma.admin.create({
        data: {
          userId: existingUser.id,
        },
      });
    }
    logger.log(`Super Admin verified & updated successfully (${phone})`);
  }
}
