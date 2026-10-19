import * as argon2 from 'argon2';
import {
  AppointmentStatus,
  AttendanceStatus,
  Gender,
  NotificationType,
  PaymentMethod,
  Prisma,
  PrismaClient,
  Role,
  TransactionDirection,
  TransactionType,
} from '@prisma/client';

export const SEED_DATASET_VERSION = 'massaj-development-v2';
export const SEED_DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'SeedPassword123!';

export const SEED_IDS = {
  users: {
    superAdmin: '10000000-0000-4000-8000-000000000001',
    admin: '10000000-0000-4000-8000-000000000002',
    specialist1: '10000000-0000-4000-8000-000000000003',
    specialist2: '10000000-0000-4000-8000-000000000004',
    parent1: '10000000-0000-4000-8000-000000000005',
    parent2: '10000000-0000-4000-8000-000000000006',
    parent3: '10000000-0000-4000-8000-000000000007',
  },
  admins: {
    superAdmin: '20000000-0000-4000-8000-000000000001',
    admin: '20000000-0000-4000-8000-000000000002',
  },
  specialists: [
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
  ],
  parents: [
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000003',
  ],
  children: [
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000003',
  ],
  services: [
    '60000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000003',
  ],
  center: '70000000-0000-4000-8000-000000000001',
} as const;

export interface SeedSummary {
  datasetVersion: string;
  users: number;
  appointments: number;
  attendances: number;
  payments: number;
  transactions: number;
  notifications: number;
  expectedStates: Array<{ parentId: string; balance: number; debt: number }>;
}

function assertDevelopmentDatabase(): void {
  if (process.env.NODE_ENV === 'production') throw new Error('Development seed is disabled in production');
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is required');
  const url = new URL(raw);
  if (!new Set(['localhost', '127.0.0.1', '::1', '[::1]']).has(url.hostname)) {
    throw new Error('Development seed requires a localhost PostgreSQL database');
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const schema = url.searchParams.get('schema') ?? 'public';
  const permittedDatabase = database === 'child_rehab_crm' || /(?:_dev|_test)$/.test(database);
  const permittedSchema = /^codex_e2e_\d+_\d+$/.test(schema);
  if (!permittedDatabase && !permittedSchema) {
    throw new Error(`Refusing to seed unapproved database "${database}" (schema "${schema}")`);
  }
}

function seedDate(anchor: Date, dayOffset: number, hourUtc: number): Date {
  const value = new Date(anchor);
  value.setUTCDate(value.getUTCDate() + dayOffset);
  value.setUTCHours(hourUtc, 0, 0, 0);
  return value;
}

function marker(value: Prisma.JsonValue | null): { version?: string; anchorDate?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const row = value as Record<string, Prisma.JsonValue>;
  return {
    version: typeof row.seedDatasetVersion === 'string' ? row.seedDatasetVersion : undefined,
    anchorDate: typeof row.seedAnchorDate === 'string' ? row.seedAnchorDate : undefined,
  };
}

export async function seedDatabase(prisma: PrismaClient): Promise<SeedSummary> {
  assertDevelopmentDatabase();
  const [userCount, existingCenter] = await Promise.all([
    prisma.user.count(),
    prisma.centerSettings.findUnique({ where: { id: SEED_IDS.center }, select: { notificationSettings: true } }),
  ]);
  const existingMarker = marker(existingCenter?.notificationSettings ?? null);
  if (userCount > 0 && existingMarker.version !== SEED_DATASET_VERSION) {
    throw new Error(
      'Database is not empty and does not contain the approved v2 seed marker. Use the guarded development reset after backup.',
    );
  }

  const anchor = existingMarker.anchorDate ? new Date(existingMarker.anchorDate) : new Date();
  anchor.setUTCHours(0, 0, 0, 0);
  const passwordHash = await argon2.hash(SEED_DEFAULT_PASSWORD);

  await prisma.$transaction(async (tx) => {
    const users = [
      { id: SEED_IDS.users.superAdmin, fullName: 'Massaj Super Admin', phone: '+998901000001', role: Role.SUPER_ADMIN },
      { id: SEED_IDS.users.admin, fullName: 'Massaj Admin', phone: '+998901000002', role: Role.ADMIN },
      { id: SEED_IDS.users.specialist1, fullName: 'Dilnoza Karimova', phone: '+998902000001', role: Role.SPECIALIST },
      { id: SEED_IDS.users.specialist2, fullName: 'Aziz Rahimov', phone: '+998902000002', role: Role.SPECIALIST },
      { id: SEED_IDS.users.parent1, fullName: 'Malika Aliyeva', phone: '+998903000001', role: Role.PARENT },
      { id: SEED_IDS.users.parent2, fullName: 'Jasur Sobirov', phone: '+998903000002', role: Role.PARENT },
      { id: SEED_IDS.users.parent3, fullName: 'Nodira Ismoilova', phone: '+998903000003', role: Role.PARENT },
    ];
    for (const user of users) {
      await tx.user.upsert({
        where: { id: user.id },
        create: { ...user, passwordHash },
        update: { fullName: user.fullName, phone: user.phone, role: user.role, status: 'ACTIVE' },
      });
      await tx.notificationPreference.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    }

    await tx.admin.upsert({
      where: { id: SEED_IDS.admins.superAdmin },
      create: { id: SEED_IDS.admins.superAdmin, userId: SEED_IDS.users.superAdmin },
      update: { userId: SEED_IDS.users.superAdmin },
    });
    await tx.admin.upsert({
      where: { id: SEED_IDS.admins.admin },
      create: { id: SEED_IDS.admins.admin, userId: SEED_IDS.users.admin },
      update: { userId: SEED_IDS.users.admin },
    });

    const specialistRows = [
      { id: SEED_IDS.specialists[0], userId: SEED_IDS.users.specialist1, specialization: 'Bolalar massaji', experienceYears: 8 },
      { id: SEED_IDS.specialists[1], userId: SEED_IDS.users.specialist2, specialization: 'Davolovchi jismoniy tarbiya', experienceYears: 6 },
    ];
    for (const row of specialistRows) {
      await tx.specialist.upsert({ where: { id: row.id }, create: row, update: row });
    }

    const parentRows = [
      { id: SEED_IDS.parents[0], userId: SEED_IDS.users.parent1, address: 'Toshkent, Chilonzor' },
      { id: SEED_IDS.parents[1], userId: SEED_IDS.users.parent2, address: 'Toshkent, Yunusobod' },
      { id: SEED_IDS.parents[2], userId: SEED_IDS.users.parent3, address: 'Toshkent, Mirzo Ulugbek' },
    ];
    for (const row of parentRows) await tx.parent.upsert({ where: { id: row.id }, create: row, update: row });

    const childRows = [
      { id: SEED_IDS.children[0], firstName: 'Asilbek', lastName: 'Aliyev', birthDate: new Date('2018-04-12'), gender: Gender.MALE },
      { id: SEED_IDS.children[1], firstName: 'Muslima', lastName: 'Sobirova', birthDate: new Date('2019-08-03'), gender: Gender.FEMALE },
      { id: SEED_IDS.children[2], firstName: 'Ibrohim', lastName: 'Ismoilov', birthDate: new Date('2017-11-21'), gender: Gender.MALE },
    ];
    for (const row of childRows) await tx.child.upsert({ where: { id: row.id }, create: row, update: row });
    for (let index = 0; index < childRows.length; index += 1) {
      const childId = SEED_IDS.children[index]!;
      const parentId = SEED_IDS.parents[index]!;
      await tx.childParent.upsert({
        where: { childId_parentId: { childId, parentId } },
        create: { childId, parentId, relationship: index === 1 ? 'Father' : 'Mother', isPrimary: true },
        update: { isPrimary: true },
      });
    }

    const serviceRows = [
      { id: SEED_IDS.services[0], name: 'Bolalar massaji', description: '45 daqiqalik davolovchi massaj', durationMinutes: 45, price: 150_000 },
      { id: SEED_IDS.services[1], name: 'LFK terapiya', description: '60 daqiqalik individual mashgulot', durationMinutes: 60, price: 180_000 },
      { id: SEED_IDS.services[2], name: 'Kompleks reabilitatsiya', description: '90 daqiqalik kompleks seans', durationMinutes: 90, price: 200_000 },
    ] as const;
    for (const row of serviceRows) await tx.service.upsert({ where: { id: row.id }, create: row, update: row });

    const prices = [150_000, 180_000, 200_000] as const;
    const specialistIds = [SEED_IDS.specialists[0], SEED_IDS.specialists[1], SEED_IDS.specialists[0]] as const;
    const parentUserIds = [SEED_IDS.users.parent1, SEED_IDS.users.parent2, SEED_IDS.users.parent3] as const;
    for (let course = 0; course < 3; course += 1) {
      const childId = SEED_IDS.children[course]!;
      const parentId = SEED_IDS.parents[course]!;
      const specialistId = specialistIds[course]!;
      const service = serviceRows[course]!;
      const parentUserId = parentUserIds[course]!;
      const price = prices[course]!;
      for (let sequence = 1; sequence <= 10; sequence += 1) {
        const suffix = String(course * 10 + sequence).padStart(12, '0');
        const appointmentId = `80000000-0000-4000-8000-${suffix}`;
        const isCompleted = sequence <= 6;
        const dayOffset = isCompleted ? -70 + sequence * 7 + course : 7 + (sequence - 7) * 7 + course;
        const startAt = seedDate(anchor, dayOffset, 8 + course * 2);
        const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);
        await tx.appointment.upsert({
          where: { id: appointmentId },
          create: {
            id: appointmentId,
            childId,
            parentId,
            specialistId,
            serviceId: service.id,
            startAt,
            endAt,
            status: isCompleted ? AppointmentStatus.COMPLETED : AppointmentStatus.CONFIRMED,
            courseKey: `seed-course-${course + 1}`,
            sequenceNumber: sequence,
            notes: `10 seanslik kurs: ${sequence}/10`,
          },
          update: {
            childId,
            parentId,
            specialistId,
            serviceId: service.id,
            startAt,
            endAt,
            status: isCompleted ? AppointmentStatus.COMPLETED : AppointmentStatus.CONFIRMED,
            courseKey: `seed-course-${course + 1}`,
            sequenceNumber: sequence,
            notes: `10 seanslik kurs: ${sequence}/10`,
          },
        });

        if (isCompleted) {
          const attendanceId = `81000000-0000-4000-8000-${suffix}`;
          await tx.attendance.upsert({
            where: { id: attendanceId },
            create: {
              id: attendanceId,
              appointmentId,
              childId,
              specialistId,
              date: startAt,
              status: AttendanceStatus.PRESENT,
              note: `Kurs seansi ${sequence}/10 otildi`,
            },
            update: {
              appointmentId,
              childId,
              specialistId,
              date: startAt,
              status: AttendanceStatus.PRESENT,
              note: `Kurs seansi ${sequence}/10 otildi`,
            },
          });
          const transactionId = `82000000-0000-4000-8000-${suffix}`;
          await tx.transaction.upsert({
            where: { id: transactionId },
            create: {
              id: transactionId,
              parentId,
              childId,
              appointmentId,
              type: TransactionType.SESSION_CHARGE,
              direction: TransactionDirection.OUT,
              amount: price,
              description: `${service.name}: ${sequence}/10 seans`,
              idempotencyKey: `seed:charge:${appointmentId}`,
              createdAt: startAt,
            },
            update: {
              parentId,
              childId,
              appointmentId,
              paymentId: null,
              type: TransactionType.SESSION_CHARGE,
              direction: TransactionDirection.OUT,
              amount: price,
              description: `${service.name}: ${sequence}/10 seans`,
              idempotencyKey: `seed:charge:${appointmentId}`,
              createdAt: startAt,
            },
          });
        } else {
          await tx.notification.upsert({
            where: { dedupeKey: `seed:appointment:${appointmentId}` },
            create: {
              userId: parentUserId,
              type: NotificationType.APPOINTMENT,
              title: 'Qabul eslatmasi',
              message: `${sequence}/10 seans ${startAt.toISOString()} vaqtiga belgilangan.`,
              relatedEntity: 'Appointment',
              relatedEntityId: appointmentId,
              dedupeKey: `seed:appointment:${appointmentId}`,
            },
            update: {
              userId: parentUserId,
              type: NotificationType.APPOINTMENT,
              title: 'Qabul eslatmasi',
              message: `${sequence}/10 seans ${startAt.toISOString()} vaqtiga belgilangan.`,
              relatedEntity: 'Appointment',
              relatedEntityId: appointmentId,
            },
          });
        }
      }

      const assessmentId = `83000000-0000-4000-8000-${String(course + 1).padStart(12, '0')}`;
      await tx.assessment.upsert({
        where: { id: assessmentId },
        create: {
          id: assessmentId,
          childId,
          specialistId,
          movement: 'Harakat amplitudasi yaxshilanmoqda',
          coordination: 'Koordinatsiya mashqlariga javob ijobiy',
          professionalObservation: 'Kurs reja boyicha davom ettirilsin.',
          assessedAt: seedDate(anchor, -14 + course, 9),
        },
        update: {
          childId,
          specialistId,
          movement: 'Harakat amplitudasi yaxshilanmoqda',
          coordination: 'Koordinatsiya mashqlariga javob ijobiy',
          professionalObservation: 'Kurs reja boyicha davom ettirilsin.',
          assessedAt: seedDate(anchor, -14 + course, 9),
        },
      });
      const progressId = `84000000-0000-4000-8000-${String(course + 1).padStart(12, '0')}`;
      await tx.progressEntry.upsert({
        where: { id: progressId },
        create: {
          id: progressId,
          childId,
          specialistId,
          createdById: course === 0 ? SEED_IDS.users.specialist1 : course === 1 ? SEED_IDS.users.specialist2 : SEED_IDS.users.specialist1,
          title: '6-seansdan keyingi progress',
          description: 'Asosiy harakatlar va mushak tonusida ijobiy dinamika kuzatildi.',
          occurredAt: seedDate(anchor, -7 + course, 10),
        },
        update: {
          childId,
          specialistId,
          createdById: course === 1 ? SEED_IDS.users.specialist2 : SEED_IDS.users.specialist1,
          title: '6-seansdan keyingi progress',
          description: 'Asosiy harakatlar va mushak tonusida ijobiy dinamika kuzatildi.',
          occurredAt: seedDate(anchor, -7 + course, 10),
        },
      });
    }

    const paymentAmounts = [500_000, 1_080_000, 1_400_000] as const;
    for (let index = 0; index < 3; index += 1) {
      const parentId = SEED_IDS.parents[index]!;
      const childId = SEED_IDS.children[index]!;
      const parentUserId = parentUserIds[index]!;
      const amount = paymentAmounts[index]!;
      const suffix = String(index + 1).padStart(12, '0');
      const paymentId = `85000000-0000-4000-8000-${suffix}`;
      const paidAt = seedDate(anchor, -5 + index, 12);
      await tx.payment.upsert({
        where: { id: paymentId },
        create: {
          id: paymentId,
          parentId,
          childId,
          amount,
          method: index === 0 ? PaymentMethod.CASH : index === 1 ? PaymentMethod.CARD : PaymentMethod.TRANSFER,
          note: 'Tasdiqlangan development seed tolovi',
          paidAt,
          idempotencyKey: `seed:payment:${index + 1}`,
        },
        update: {
          parentId,
          childId,
          amount,
          method: index === 0 ? PaymentMethod.CASH : index === 1 ? PaymentMethod.CARD : PaymentMethod.TRANSFER,
          note: 'Tasdiqlangan development seed tolovi',
          paidAt,
          idempotencyKey: `seed:payment:${index + 1}`,
        },
      });
      await tx.transaction.upsert({
        where: { id: `86000000-0000-4000-8000-${suffix}` },
        create: {
          id: `86000000-0000-4000-8000-${suffix}`,
          parentId,
          childId,
          paymentId,
          type: TransactionType.PAYMENT,
          direction: TransactionDirection.IN,
          amount,
          description: 'Tasdiqlangan development seed tolovi',
          idempotencyKey: `payment:seed:payment:${index + 1}`,
          createdAt: paidAt,
        },
        update: {
          parentId,
          childId,
          paymentId,
          appointmentId: null,
          type: TransactionType.PAYMENT,
          direction: TransactionDirection.IN,
          amount,
          description: 'Tasdiqlangan development seed tolovi',
          idempotencyKey: `payment:seed:payment:${index + 1}`,
          createdAt: paidAt,
        },
      });
      await tx.notification.upsert({
        where: { dedupeKey: `payment-received:${paymentId}` },
        create: {
          userId: parentUserId,
          type: NotificationType.PAYMENT,
          title: 'Tolov qabul qilindi',
          message: `${amount.toLocaleString()} UZS tolov tasdiqlandi.`,
          relatedEntity: 'Payment',
          relatedEntityId: paymentId,
          dedupeKey: `payment-received:${paymentId}`,
        },
        update: {
          userId: parentUserId,
          type: NotificationType.PAYMENT,
          title: 'Tolov qabul qilindi',
          message: `${amount.toLocaleString()} UZS tolov tasdiqlandi.`,
          relatedEntity: 'Payment',
          relatedEntityId: paymentId,
        },
      });
    }

    await tx.centerSettings.upsert({
      where: { id: SEED_IDS.center },
      create: {
        id: SEED_IDS.center,
        centerName: 'Massaj CRM Development Center',
        phone: '+998901000000',
        address: 'Toshkent shahri',
        notificationSettings: {
          seedDatasetVersion: SEED_DATASET_VERSION,
          seedAnchorDate: anchor.toISOString(),
          warning: 'Development/test data only',
        },
      },
      update: {
        notificationSettings: {
          seedDatasetVersion: SEED_DATASET_VERSION,
          seedAnchorDate: anchor.toISOString(),
          warning: 'Development/test data only',
        },
      },
    });
  }, { timeout: 30_000 });

  return verifySeedDatabase(prisma);
}

export async function verifySeedDatabase(prisma: PrismaClient): Promise<SeedSummary> {
  const [users, appointments, attendances, payments, transactions, notifications, linkedPayments] = await Promise.all([
    prisma.user.count({ where: { id: { in: Object.values(SEED_IDS.users) } } }),
    prisma.appointment.count({ where: { courseKey: { startsWith: 'seed-course-' } } }),
    prisma.attendance.count({ where: { appointment: { courseKey: { startsWith: 'seed-course-' } } } }),
    prisma.payment.count({ where: { idempotencyKey: { startsWith: 'seed:payment:' } } }),
    prisma.transaction.count({
      where: {
        OR: [
          { idempotencyKey: { startsWith: 'seed:charge:' } },
          { idempotencyKey: { startsWith: 'payment:seed:payment:' } },
        ],
      },
    }),
    prisma.notification.count({ where: { OR: [{ dedupeKey: { startsWith: 'seed:' } }, { dedupeKey: { startsWith: 'payment-received:85' } }] } }),
    prisma.payment.count({
      where: {
        idempotencyKey: { startsWith: 'seed:payment:' },
        transactions: { some: { type: TransactionType.PAYMENT } },
      },
    }),
  ]);
  if (
    users !== 7 ||
    appointments !== 30 ||
    attendances !== 18 ||
    payments !== 3 ||
    linkedPayments !== 3 ||
    transactions !== 21 ||
    notifications !== 15
  ) {
    throw new Error(
      `Seed integrity failure: users=${users}, appointments=${appointments}, attendances=${attendances}, payments=${payments}, linkedPayments=${linkedPayments}, transactions=${transactions}, notifications=${notifications}`,
    );
  }
  const seededPayments = await prisma.payment.findMany({
    where: { idempotencyKey: { startsWith: 'seed:payment:' } },
    select: {
      id: true,
      parentId: true,
      childId: true,
      amount: true,
      transactions: {
        where: { type: TransactionType.PAYMENT },
        select: { parentId: true, childId: true, amount: true, direction: true },
      },
    },
  });
  for (const payment of seededPayments) {
    const ledger = payment.transactions;
    if (
      ledger.length !== 1 ||
      ledger[0]?.parentId !== payment.parentId ||
      ledger[0]?.childId !== payment.childId ||
      ledger[0]?.amount !== payment.amount ||
      ledger[0]?.direction !== TransactionDirection.IN
    ) {
      throw new Error(`Seed payment ledger mismatch for payment ${payment.id}`);
    }
  }
  const expectedStates = [
    { parentId: SEED_IDS.parents[0], balance: 0, debt: 400_000 },
    { parentId: SEED_IDS.parents[1], balance: 0, debt: 0 },
    { parentId: SEED_IDS.parents[2], balance: 200_000, debt: 0 },
  ];
  for (const expected of expectedStates) {
    const rows = await prisma.transaction.findMany({
      where: { parentId: expected.parentId },
      select: { amount: true, direction: true },
    });
    const net = rows.reduce((sum, row) => sum + (row.direction === TransactionDirection.IN ? row.amount : -row.amount), 0);
    if (Math.max(0, net) !== expected.balance || Math.max(0, -net) !== expected.debt) {
      throw new Error(`Seed ledger mismatch for parent ${expected.parentId}`);
    }
  }
  return { datasetVersion: SEED_DATASET_VERSION, users, appointments, attendances, payments, transactions, notifications, expectedStates };
}
