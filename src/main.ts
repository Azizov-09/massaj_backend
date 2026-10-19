import 'reflect-metadata';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app/app.module';
import { PrismaService } from './database/prisma.service';
import { seedDatabase } from './database/seed';
import { seedSuperAdmin } from './database/super-admin.seed';
import { trustedFrontendOrigins } from './common/utils/http-config.util';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.set('trust proxy', 1);

  app.setGlobalPrefix('api/v1');

  // Security HTTP Headers with CSP safe for Swagger UI
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
          scriptSrc: [`'self'`, `'unsafe-inline'`, `'unsafe-eval'`],
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(cookieParser());

  // Cross-Origin Resource Sharing (CORS) Policy
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = trustedFrontendOrigins();

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  });

  // Strict Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Global serializer: strips @Exclude() fields (e.g. passwordHash, tokenVersion)
  // from ALL response entities automatically — critical security layer
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Complete OpenAPI / Swagger Specification
  const config = new DocumentBuilder()
    .setTitle("Children's Massage & Rehabilitation CRM API")
    .setDescription(
      'Enterprise-grade, secure RESTful API backend for pediatric massage therapy, physical rehabilitation, scheduling, financial ledger, and parent portal.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT access token (Bearer <token>)',
        in: 'header',
      },
      'bearer',
    )
    .addCookieAuth('refresh_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'refresh_token',
      description: 'HttpOnly cryptographic refresh cookie',
    })
    .addTag('Authentication', 'Login, token refresh, multi-device logout, and password change')
    .addTag('Admins', 'Administrator account management — create, list, update, archive (SUPER_ADMIN only)')
    .addTag('Employees', 'Non-medical staff management — receptionist, nurse, accountant, etc.')
    .addTag('Profiles', 'Admin, Specialist, and Parent account profile operations')
    .addTag('Children', 'Child records, intake profiles, and parental custody delegation')
    .addTag('Appointments', 'Course scheduling, calendar visibility, and appointment lifecycle')
    .addTag('Clinical Records', 'Clinical assessments, attendance, and developmental progress')
    .addTag('Finance', 'Payments, balance calculations, refunds, and double-entry ledger transactions')
    .addTag('Services', 'Clinic therapy service catalog, duration, and price tiers')
    .addTag('Role Portals', 'Dedicated role-specific portals for parents and specialists')
    .addTag('Platform', 'Medical consents, document uploads, system settings, and audit logs')
    .addTag('Announcements', 'System-wide broadcasts and parent notices')
    .addTag('Analytics', 'Executive KPIs, revenue trends, occupancy, and retention metrics')
    .addTag('Reports', 'Detailed administrative and clinical reporting')
    .addTag('Notifications', 'In-app notification feeds, preference management, and delivery analytics')
    .addTag('Health Probes', 'PostgreSQL and Redis liveness and readiness probes')
    .build();

  const swaggerEnabled = !isProd || process.env.SWAGGER_ENABLED === 'true';
  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'none',
        filter: true,
      },
    });
  }

  const prisma = app.get(PrismaService);
  prisma.enableShutdownHooks(app);

  // Mock data is never created implicitly. It must be explicitly enabled for an
  // approved development/test environment or loaded by the guarded reset tool.
  const autoSeed = process.env.AUTO_SEED === 'true';
  try {
    const userCount = await prisma.user.count();
    if (!isProd && autoSeed) {
      logger.log(`[AutoSeed] Checking/seeding development database (autoSeed=${autoSeed}, currentUsers=${userCount})...`);
      await seedDatabase(prisma);
    } else if (!isProd && userCount === 0) {
      logger.warn('[AutoSeed] Development database is empty. Run the guarded reset/seed command explicitly.');
    } else if (isProd && userCount === 0) {
      logger.warn('[AutoSeed] Production database has 0 users. Mock seeding is disabled in production for safety.');
    }
  } catch (err) {
    logger.error('[AutoSeed] Error during initial database seed check:', err);
  }

  // Production creates only the configured Super Admin. In development this is
  // idempotent and coexists with the deterministic seed identity.
  try {
    await seedSuperAdmin(prisma);
  } catch (err) {
    logger.error('[SuperAdminSeed] Error during initial super admin seed check:', err);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`Server listening on port ${port}`);
  if (swaggerEnabled) logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}

void bootstrap();
