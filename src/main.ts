import 'reflect-metadata';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app/app.module';
import { PrismaService } from './database/prisma.service';
import { seedDatabase } from './database/seed';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

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
  const allowedOrigins: (string | RegExp)[] = [
    'https://massaj-frontent.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    /^https:\/\/massaj-frontent.*\.vercel\.app$/,
  ];
  if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Set-Cookie'],
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
    .addTag('Appointments', 'Booking calendar, slot conflict detection, and lifecycle management')
    .addTag('Sessions', 'Clinical execution, attendance verification, and therapy completion')
    .addTag('Clinical Records', 'SOAP clinical assessments, developmental milestones, and therapy goals')
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

  const prisma = app.get(PrismaService);
  prisma.enableShutdownHooks(app);

  // Auto-seed mock data on startup if AUTO_SEED=true or if database has no users
  const autoSeed = process.env.AUTO_SEED === 'true';
  try {
    const userCount = await prisma.user.count();
    if (autoSeed || userCount === 0) {
      logger.log(`[AutoSeed] Checking/seeding database (autoSeed=${autoSeed}, currentUsers=${userCount})...`);
      await seedDatabase(prisma, autoSeed);
    }
  } catch (err) {
    logger.error('[AutoSeed] Error during initial database seed check:', err);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`Server listening on port ${port}`);
  logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}

void bootstrap();
