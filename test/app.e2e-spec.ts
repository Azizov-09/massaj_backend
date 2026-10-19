import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { Gender, PaymentMethod, Role, UserStatus } from '@prisma/client';
import { SEED_DEFAULT_PASSWORD, SEED_IDS } from '../src/database/seed';
import { trustedFrontendOrigins } from '../src/common/utils/http-config.util';

describe('Rehabilitation Center CRM (Comprehensive E2E Tests)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testPassword = 'Password123456';
  let superAdminToken: string;
  let adminToken: string;
  let specialistToken: string;
  let parentToken: string;
  let parent2Token: string;

  let specialistProfileId: string;
  let parentProfileId: string;
  let parent2ProfileId: string;
  let childId: string;
  let serviceId: string;
  let appointmentId: string;
  let paymentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.enableCors({
      origin: trustedFrontendOrigins(),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    // Clean up test users / data if leftover from previous test run
    const testPhones = [
      '+998900000001',
      '+998900000002',
      '+998900000003',
      '+998900000004',
      '+998900000005',
      '+998900000006',
    ];
    await prisma.notificationDelivery.deleteMany({
      where: { notification: { user: { phone: { in: testPhones } } } },
    });
    await prisma.notification.deleteMany({
      where: { user: { phone: { in: testPhones } } },
    });
    await prisma.transaction.deleteMany({
      where: { parent: { user: { phone: { in: testPhones } } } },
    });
    await prisma.payment.deleteMany({
      where: { parent: { user: { phone: { in: testPhones } } } },
    });
    await prisma.childParent.deleteMany({
      where: { parent: { user: { phone: { in: testPhones } } } },
    });
    await prisma.child.deleteMany({
      where: { firstName: 'E2E-Child' },
    });
    await prisma.service.deleteMany({
      where: { name: 'E2E Pediatric Massage' },
    });
    await prisma.userSession.deleteMany({
      where: { user: { phone: { in: testPhones } } },
    });
    await prisma.notificationPreference.deleteMany({
      where: { user: { phone: { in: testPhones } } },
    });
    await prisma.parent.deleteMany({
      where: { user: { phone: { in: testPhones } } },
    });
    await prisma.specialist.deleteMany({
      where: { user: { phone: { in: testPhones } } },
    });
    await prisma.admin.deleteMany({
      where: { user: { phone: { in: testPhones } } },
    });
    await prisma.user.deleteMany({
      where: { phone: { in: testPhones } },
    });

    const passwordHash = await argon2.hash(testPassword, { type: argon2.argon2id });

    // 1. Super Admin
    await prisma.user.create({
      data: {
        fullName: 'Super Admin E2E',
        phone: '+998900000001',
        passwordHash,
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        admin: { create: {} },
        preferences: { create: {} },
      },
    });

    // 2. Admin
    await prisma.user.create({
      data: {
        fullName: 'Admin E2E',
        phone: '+998900000002',
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        admin: { create: {} },
        preferences: { create: {} },
      },
    });

    // 3. Specialist
    const specialistUser = await prisma.user.create({
      data: {
        fullName: 'Specialist E2E',
        phone: '+998900000003',
        passwordHash,
        role: Role.SPECIALIST,
        status: UserStatus.ACTIVE,
        specialist: {
          create: {
            specialization: 'Pediatric Massage & Rehab',
            experienceYears: 7,
          },
        },
        preferences: { create: {} },
      },
      include: { specialist: true },
    });
    specialistProfileId = specialistUser.specialist!.id;

    // 4. Parent 1
    const parent1User = await prisma.user.create({
      data: {
        fullName: 'Parent One E2E',
        phone: '+998900000004',
        passwordHash,
        role: Role.PARENT,
        status: UserStatus.ACTIVE,
        parent: { create: { address: 'Tashkent, Chilanzar 5' } },
        preferences: { create: {} },
      },
      include: { parent: true },
    });
    parentProfileId = parent1User.parent!.id;

    // 5. Parent 2 (for IDOR isolation testing)
    const parent2User = await prisma.user.create({
      data: {
        fullName: 'Parent Two E2E',
        phone: '+998900000005',
        passwordHash,
        role: Role.PARENT,
        status: UserStatus.ACTIVE,
        parent: { create: { address: 'Tashkent, Yunusabad 12' } },
        preferences: { create: {} },
      },
      include: { parent: true },
    });
    parent2ProfileId = parent2User.parent!.id;

    // 6. Blocked User
    await prisma.user.create({
      data: {
        fullName: 'Blocked User E2E',
        phone: '+998900000006',
        passwordHash,
        role: Role.PARENT,
        status: UserStatus.BLOCKED,
        parent: { create: {} },
        preferences: { create: {} },
      },
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Health Check (PostgreSQL & Redis)', () => {
    it('GET /api/v1/health returns 200 with database and redis connected', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      expect(res.body).toEqual({
        status: 'ok',
        database: 'connected',
        redis: 'connected',
      });
    });

    it('allows credentialed CORS only for a configured frontend origin', async () => {
      const allowed = await request(app.getHttpServer())
        .options('/api/v1/auth/refresh')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);
      expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(allowed.headers['access-control-allow-credentials']).toBe('true');

      const rejected = await request(app.getHttpServer())
        .options('/api/v1/auth/refresh')
        .set('Origin', 'https://attacker.example')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);
      expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Seeded finalization business flow', () => {
    it('runs login, schedule, clinical, partial debt, ledger, notification, refresh, logout, and relogin', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '+998901000001', password: SEED_DEFAULT_PASSWORD })
        .expect(200);
      const accessToken = login.body.accessToken as string;
      const originalCookie = (((login.headers['set-cookie'] as string[] | undefined) ?? [])[0] ?? '').split(';')[0];
      if (!originalCookie) throw new Error('Login did not set the refresh cookie');

      const schedule = await request(app.getHttpServer())
        .get('/api/v1/appointments')
        .query({ childId: SEED_IDS.children[0], page: 1, limit: 20 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(schedule.body.items).toHaveLength(10);
      expect(schedule.body.items.filter((row: { status: string }) => row.status === 'COMPLETED')).toHaveLength(6);

      const [assessments, progress, initialBalance] = await Promise.all([
        request(app.getHttpServer()).get('/api/v1/assessments').query({ childId: SEED_IDS.children[0] }).set('Authorization', `Bearer ${accessToken}`).expect(200),
        request(app.getHttpServer()).get('/api/v1/progress').query({ childId: SEED_IDS.children[0] }).set('Authorization', `Bearer ${accessToken}`).expect(200),
        request(app.getHttpServer()).get(`/api/v1/children/${SEED_IDS.children[0]}/balance`).set('Authorization', `Bearer ${accessToken}`).expect(200),
      ]);
      expect(assessments.body.items).toHaveLength(1);
      expect(progress.body.items).toHaveLength(1);
      expect(initialBalance.body[0].debt).toBe(400_000);

      const paymentKey = 'seeded-e2e-partial-payment';
      const payment = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          parentId: SEED_IDS.parents[0],
          childId: SEED_IDS.children[0],
          amount: 100_000,
          method: PaymentMethod.CASH,
          note: 'Seeded flow partial debt payment',
          idempotencyKey: paymentKey,
        })
        .expect(201);

      const [balance, transactions, debtors] = await Promise.all([
        request(app.getHttpServer()).get(`/api/v1/children/${SEED_IDS.children[0]}/balance`).set('Authorization', `Bearer ${accessToken}`).expect(200),
        request(app.getHttpServer()).get('/api/v1/transactions').query({ childId: SEED_IDS.children[0] }).set('Authorization', `Bearer ${accessToken}`).expect(200),
        request(app.getHttpServer()).get('/api/v1/debtors').set('Authorization', `Bearer ${accessToken}`).expect(200),
      ]);
      expect(balance.body[0].debt).toBe(300_000);
      expect(transactions.body.items.some((row: { paymentId?: string }) => row.paymentId === payment.body.id)).toBe(true);
      expect(debtors.body.some((row: { parentId: string; debt: number }) => row.parentId === SEED_IDS.parents[0] && row.debt === 300_000)).toBe(true);

      const parentLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '+998903000001', password: SEED_DEFAULT_PASSWORD })
        .expect(200);
      const notifications = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${parentLogin.body.accessToken}`)
        .expect(200);
      expect(notifications.body.items.some((row: { relatedEntityId?: string }) => row.relatedEntityId === payment.body.id)).toBe(true);

      const refreshed = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', originalCookie)
        .send({})
        .expect(200);
      const rotatedCookie = ((((refreshed.headers['set-cookie'] as string[] | undefined) ?? [])[0] ?? '')).split(';')[0];
      if (!rotatedCookie) throw new Error('Refresh did not rotate the refresh cookie');
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
        .set('Cookie', rotatedCookie)
        .send({})
        .expect(204);
      await request(app.getHttpServer())
        .get('/api/v1/services')
        .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '+998901000001', password: SEED_DEFAULT_PASSWORD })
        .expect(200);
    });
  });

  describe('Authentication Security Workflows', () => {
    it('rejects login with wrong password (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '+998900000001', password: 'WrongPassword123' })
        .expect(401);
    });

    it('rejects login for BLOCKED user (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '+998900000006', password: testPassword })
        .expect(401);
    });

    it('logs in SUPER_ADMIN and sets secure refresh cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '+998900000001', password: testPassword })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.role).toBe(Role.SUPER_ADMIN);
      expect(res.headers['set-cookie']).toBeDefined();
      superAdminToken = res.body.accessToken;
    });

    it('logs in ADMIN, SPECIALIST, PARENT, and PARENT 2', async () => {
      // Admin
      const resAdmin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '+998900000002', password: testPassword })
        .expect(200);
      adminToken = resAdmin.body.accessToken;

      // Specialist
      const resSpec = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '+998900000003', password: testPassword })
        .expect(200);
      specialistToken = resSpec.body.accessToken;

      // Parent 1
      const resParent = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '+998900000004', password: testPassword })
        .expect(200);
      parentToken = resParent.body.accessToken;

      // Parent 2
      const resParent2 = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '+998900000005', password: testPassword })
        .expect(200);
      parent2Token = resParent2.body.accessToken;
    });

    it('rotates refresh token successfully', async () => {
      // Perform fresh login to get refresh token cookie
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '+998900000002', password: testPassword })
        .expect(200);

      const setCookie = loginRes.headers['set-cookie'] as string[] | undefined;
      const cookieHeader = (setCookie ?? [])[0] ?? '';
      const match = cookieHeader.match(/refresh_token=([^;]+)/);
      const rawRefreshToken = match ? match[1] : '';

      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawRefreshToken })
        .expect(200);

      expect(refreshRes.body.accessToken).toBeDefined();

      // Refresh reuse detection: using rawRefreshToken a second time must be rejected
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawRefreshToken })
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/v1/services')
        .set('Authorization', `Bearer ${refreshRes.body.accessToken}`)
        .expect(401);

      // Replay containment revokes every ADMIN session, so establish a new session
      // before later authorization scenarios.
      const relogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '+998900000002', password: testPassword })
        .expect(200);
      adminToken = relogin.body.accessToken;
    });

    it('rejects an expired access token but refreshes its still-valid session cookie', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '+998900000004', password: testPassword })
        .expect(200);

      const jwt = app.get(JwtService);
      const payload = jwt.decode(loginRes.body.accessToken) as {
        sub: string;
        sid: string;
        role: Role;
        tv: number;
      };
      const expiredAccessToken = await jwt.signAsync(
        { sub: payload.sub, sid: payload.sid, role: payload.role, tv: payload.tv },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: -1 },
      );

      await request(app.getHttpServer())
        .get('/api/v1/parent/my-children')
        .set('Authorization', `Bearer ${expiredAccessToken}`)
        .expect(401);

      const refreshCookie = ((loginRes.headers['set-cookie'] as string[] | undefined) ?? [])[0]
        ?.split(';')[0];
      expect(refreshCookie).toBeDefined();
      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookie ?? '')
        .send({})
        .expect(200);

      expect(refreshRes.body.accessToken).toBeDefined();
    });

    it('rejects unknown DTO fields due to forbidNonWhitelisted (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          phone: '+998900000001',
          password: testPassword,
          maliciousInjectedField: 'hack',
        })
        .expect(400);
    });
  });

  describe('CRM Entity Creation & Relationship Linking', () => {
    it('creates Service (ADMIN only)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Pediatric Massage',
          description: '45-minute developmental massage',
          durationMinutes: 45,
          price: 150_000,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.price).toBe(150_000);
      serviceId = res.body.id;
    });

    it('creates Child (ADMIN only)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/children')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'E2E-Child',
          lastName: 'Temirov',
          birthDate: '2022-05-10',
          gender: Gender.MALE,
          notes: 'Hypotonia assessment requested',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      childId = res.body.id;
    });

    it('links Child to Parent 1 as primary guardian', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/parents/${parentProfileId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          relationship: 'Mother',
          isPrimary: true,
        })
        .expect(201);

      expect(res.body.isPrimary).toBe(true);
    });

    it('prevents duplicate child-parent linking (409 Conflict)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/parents/${parentProfileId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          relationship: 'Mother',
          isPrimary: true,
        })
        .expect(409);
    });
  });

  describe('IDOR & Relationship Authorization', () => {
    it('Parent 1 can access own linked child (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(res.body.id).toBe(childId);
    });

    it('Parent 2 is FORBIDDEN from accessing Parent 1’s child (403 IDOR prevention)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}`)
        .set('Authorization', `Bearer ${parent2Token}`)
        .expect(403);
    });

    it('Specialist cannot access a child before an assignment record exists (403)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}`)
        .set('Authorization', `Bearer ${specialistToken}`)
        .expect(403);
    });

    it('Parent 1 cannot access global finance or other parent balance (403)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/parents/${parent2ProfileId}/balance`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(403);
    });

    it('Parent cannot perform a financial mutation even for their own child (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          parentId: parentProfileId,
          childId,
          amount: 10_000,
          method: PaymentMethod.CASH,
          idempotencyKey: `forbidden-parent-payment-${Date.now()}`,
        })
        .expect(403);
    });
  });

  describe('Clinical Attendance Lifecycle', () => {
    let attendanceId: string;

    it('creates an appointment that is visible in the schedule', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          childId,
          parentId: parentProfileId,
          specialistId: specialistProfileId,
          serviceId,
          startAt: new Date(Date.now() - 60_000).toISOString(),
          courseKey: `e2e-course-${childId}`,
          sequenceNumber: 1,
          notes: 'E2E completed session',
        })
        .expect(201);
      appointmentId = res.body.id;

      const schedule = await request(app.getHttpServer())
        .get('/api/v1/appointments')
        .query({ childId })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(schedule.body.items.some((row: { id: string }) => row.id === appointmentId)).toBe(true);
    });

    it('records attendance against the appointment', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          appointmentId,
          childId,
          specialistId: specialistProfileId,
          status: 'PRESENT',
          note: 'Child arrived on time and completed full physical therapy routine.',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('PRESENT');
      attendanceId = res.body.id;
      const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
      expect(appointment.status).toBe('COMPLETED');
    });

    it('allows the assigned specialist to access the child after attendance assignment', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}`)
        .set('Authorization', `Bearer ${specialistToken}`)
        .expect(200);
    });

    it('updates attendance note and status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/attendance/${attendanceId}`)
        .set('Authorization', `Bearer ${specialistToken}`)
        .send({
          status: 'PRESENT',
          note: 'Updated: Excellent engagement during physical therapy.',
        })
        .expect(200);

      expect(res.body.note).toContain('Excellent engagement');
    });

    it('parent views attendance history in portal', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parent/my-attendances')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(res.body.some((a: any) => a.id === attendanceId)).toBe(true);
    });

    it('specialist views attendance history in portal', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/specialist/my-attendances')
        .set('Authorization', `Bearer ${specialistToken}`)
        .expect(200);

      expect(res.body.some((a: any) => a.id === attendanceId)).toBe(true);
    });

    it('records a SESSION_CHARGE through the protected finance API', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/charges')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          parentId: parentProfileId,
          childId,
          appointmentId,
          amount: 150_000,
          description: 'Charge for completed physical rehabilitation therapy',
          idempotencyKey: `charge-e2e-${Date.now()}`,
        })
        .expect(201);

      expect(res.body.transaction.id).toBeDefined();
      expect(res.body.transaction.amount).toBe(150_000);

      // Verify Parent 1 now has debt = 150_000
      const debtRes = await request(app.getHttpServer())
        .get('/api/v1/parent/my-debt')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(debtRes.body.debt).toBe(150_000);
    });
  });

  describe('Clinical Assessment & Progress Relations', () => {
    let assessmentId: string;
    let progressId: string;

    it('creates, lists, and retrieves an assessment with child/specialist identities', async () => {
      const assessedAt = new Date(Date.now() - 60_000).toISOString();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/assessments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          childId,
          specialistId: specialistProfileId,
          professionalObservation: 'Age-appropriate motor response with improving coordination.',
          assessedAt,
        })
        .expect(201);

      assessmentId = createRes.body.id;
      expect(createRes.body.child.fullName).toBe('E2E-Child Temirov');
      expect(createRes.body.specialist.fullName).toBe('Specialist E2E');
      expect(createRes.body.assessmentDate).toBe(assessedAt);

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/assessments')
        .query({ childId, specialistId: specialistProfileId, page: 1, limit: 10 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(listRes.body.items.some((row: { id: string }) => row.id === assessmentId)).toBe(true);

      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/assessments/${assessmentId}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);
      expect(detailRes.body.child.id).toBe(childId);
      expect(detailRes.body.specialist.id).toBe(specialistProfileId);
    });

    it('keeps treating specialist and record creator explicit in progress responses', async () => {
      const occurredAt = new Date(Date.now() - 30_000).toISOString();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/progress')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          childId,
          specialistId: specialistProfileId,
          title: 'Improved shoulder mobility',
          description: 'The child completed the guided mobility sequence without discomfort.',
          occurredAt,
        })
        .expect(201);

      progressId = createRes.body.id;
      expect(createRes.body.child.fullName).toBe('E2E-Child Temirov');
      expect(createRes.body.specialist.fullName).toBe('Specialist E2E');
      expect(createRes.body.recordedBy.fullName).toBe('Admin E2E');
      expect(createRes.body.progressDate).toBe(occurredAt);

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/progress')
        .query({ childId, specialistId: specialistProfileId, page: 1, limit: 10 })
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);
      expect(listRes.body.items.some((row: { id: string }) => row.id === progressId)).toBe(true);
    });

    it('rejects a future completed progress record without writing it', async () => {
      const before = await prisma.progressEntry.count({ where: { childId } });
      await request(app.getHttpServer())
        .post('/api/v1/progress')
        .set('Authorization', `Bearer ${specialistToken}`)
        .send({
          childId,
          title: 'Impossible future completion',
          description: 'This record must be rejected because it claims future clinical work.',
          occurredAt: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .expect(400);
      expect(await prisma.progressEntry.count({ where: { childId } })).toBe(before);
    });
  });

  describe('Transactional Finance (Debt-First Allocation & Refunds)', () => {
    it('rejects an unrelated parent-child payment without partial writes', async () => {
      const key = `invalid-relation-e2e-${Date.now()}`;
      const notificationsBefore = await prisma.notification.count({ where: { type: 'PAYMENT' } });
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          parentId: parent2ProfileId,
          childId,
          amount: 25_000,
          method: PaymentMethod.CASH,
          idempotencyKey: key,
        })
        .expect(400);

      expect(await prisma.payment.count({ where: { idempotencyKey: key } })).toBe(0);
      expect(await prisma.transaction.count({ where: { idempotencyKey: `payment:${key}` } })).toBe(0);
      expect(await prisma.notification.count({ where: { type: 'PAYMENT' } })).toBe(notificationsBefore);
    });

    it('records manual payment: pays off 150k debt and leaves 50k balance', async () => {
      // Payment of 200_000 against 150_000 debt -> remaining balance = 50_000, debt = 0
      const idempotencyKey = `pay-e2e-${Date.now()}`;
      const payload = {
        parentId: parentProfileId,
        childId,
        amount: 200_000,
        method: PaymentMethod.CASH,
        note: 'Payment in center desk',
        idempotencyKey,
      };
      const [first, duplicate] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/payments')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(payload)
          .expect(201),
        request(app.getHttpServer())
          .post('/api/v1/payments')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(payload)
          .expect(201),
      ]);

      expect(first.body.id).toBeDefined();
      expect(duplicate.body.id).toBe(first.body.id);
      paymentId = first.body.id;
      expect(await prisma.payment.count({ where: { idempotencyKey } })).toBe(1);
      expect(await prisma.transaction.count({ where: { idempotencyKey: `payment:${idempotencyKey}` } })).toBe(1);
      expect(await prisma.notification.count({
        where: { relatedEntity: 'Payment', relatedEntityId: paymentId },
      })).toBe(1);

      // Verify Parent 1 balance and debt
      const balRes = await request(app.getHttpServer())
        .get('/api/v1/parent/my-balance')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(balRes.body.balance).toBe(50_000);

      const debtRes = await request(app.getHttpServer())
        .get('/api/v1/parent/my-debt')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(debtRes.body.debt).toBe(0);
    });

    it('refunds partial payment creating compensating REFUND transaction', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 30_000,
          note: 'Client overpaid request',
          idempotencyKey: `refund-e2e-${Date.now()}`,
        })
        .expect(201);

      expect(res.body.type).toBe('REFUND');
      expect(res.body.amount).toBe(30_000);

      // Remaining balance = 50_000 - 30_000 = 20_000
      const balRes = await request(app.getHttpServer())
        .get('/api/v1/parent/my-balance')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(balRes.body.balance).toBe(20_000);
    });
  });

  describe('Announcements & Message Board', () => {
    it('SUPER_ADMIN creates and publishes announcement to ALL_PARENTS', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Holiday Schedule Notice',
          message: 'The center will be open on public holidays with regular hours.',
          audience: 'ALL_PARENTS',
          sendInApp: true,
          sendSms: false,
        })
        .expect(201);

      const announcementId = createRes.body.id;

      const pubRes = await request(app.getHttpServer())
        .post(`/api/v1/announcements/${announcementId}/publish`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(201);

      expect(pubRes.body.status).toBe('PUBLISHED');

      // Parent 1 can see published announcement in portal
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/announcements/my')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(
        listRes.body.some(
          (recipient: { announcement?: { id?: string } }) =>
            recipient.announcement?.id === announcementId,
        ),
      ).toBe(true);
    });
  });

  describe('Analytics & Reports', () => {
    it('GET /api/v1/analytics/dashboard returns accurate calculated aggregates', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.totalRevenue).toBeDefined();
      expect(res.body.activeChildren).toBeGreaterThanOrEqual(1);
      expect(res.body.totalDebt).toBeDefined();
    });

    it('GET /api/v1/reports/financial returns structured transaction report', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/financial')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(res.body.meta).toBeDefined();
    });
  });
});
