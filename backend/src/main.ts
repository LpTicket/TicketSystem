import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifyHelmet from '@fastify/helmet';
import secureSession from '@fastify/secure-session';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 10 * 1024 * 1024 }), // 10MB limit
    { rawBody: true }
  );

  const configService = app.get(ConfigService);
  const isProd = configService.get<string>('NODE_ENV') === 'production';

  // Fail fast: never run with insecure default secrets in production.
  const sessionSecret = configService.get<string>('SESSION_SECRET') || configService.get<string>('JWT_SECRET');
  if (isProd && (!configService.get<string>('JWT_SECRET') || !configService.get<string>('JWT_REFRESH_SECRET'))) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in production.');
  }
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error('A session secret of at least 32 characters is required (set SESSION_SECRET or JWT_SECRET).');
  }

  await app.register(fastifyMultipart);

  // Security headers (HSTS, X-Content-Type-Options, frameguard, etc.).
  // CSP is disabled here because the static /uploads assets and external
  // payment scripts are served cross-origin; enable a tailored policy later.
  await app.register(fastifyHelmet as any, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  });

  await app.register(secureSession, {
    secret: sessionSecret,
    salt: configService.get<string>('SESSION_SALT') || 'mq9h9p7uY9sc99h9', // Must be 16 chars
    cookie: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
    }
  });

  await app.register(fastifyStatic, {
    root: join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS — explicit allow-list. APP_URL / CORS_ORIGINS may hold a comma-separated
  // list of allowed web origins. Mobile (native) requests send no Origin header
  // and are allowed through (they are not subject to the browser same-origin policy).
  const appUrl = configService.get<string>('APP_URL') || 'http://localhost:3000';
  const extraOrigins = configService.get<string>('CORS_ORIGINS') || '';
  const allowedOrigins = new Set<string>(
    [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      ...appUrl.split(',').map((o) => o.trim()),
      ...extraOrigins.split(',').map((o) => o.trim()),
    ]
      .filter(Boolean)
      .map((o) => o.replace(/\/$/, '')),
  );

  // Local development origins are always allowed (any port on localhost /
  // 127.0.0.1 / LAN IP, plus Expo's exp:// scheme). These cannot be a CSRF
  // vector from a public attacker site, and devs run the web/Expo clients on
  // varying ports (3000, 8081, 19006, …) against the deployed API.
  const isLocalOrigin = (origin: string) =>
    /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/i.test(origin) ||
    origin.startsWith('exp://');

  const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // No Origin header → non-browser client (mobile app, curl, server-to-server).
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, '');
    if (allowedOrigins.has(normalized)) return callback(null, true);
    // Local dev clients (any port) are always allowed.
    if (isLocalOrigin(normalized)) return callback(null, true);
    // In non-production, be permissive to ease local development.
    if (!isProd) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
  };

  app.enableCors({
    origin: corsOrigin as any,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());

  // Create uploads directory
  const uploadDir = configService.get('UPLOAD_DIR') || './uploads';
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  const port = configService.get('PORT') || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 TicketPro API running on http://localhost:${port}`);
}
bootstrap();
