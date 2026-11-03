import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PassportModule } from '@nestjs/passport';
import { sign } from 'jsonwebtoken';
import { AuthService } from '../auth/auth.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { NotificationSettingsController } from './notification-settings.controller';
import { NotificationSettingsService } from './notification-settings.service';

describe('Notification administration API access', () => {
  let app: NestFastifyApplication;
  const secret = 'notification-tests-only-secret';
  const settings = { getSettings: jest.fn().mockResolvedValue({ version: 1, items: [] }), update: jest.fn().mockResolvedValue({ version: 2 }) };
  const token = (role: string) => sign({ sub: `${role}-1`, role }, secret, { expiresIn: '5m' });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [NotificationSettingsController],
      providers: [JwtStrategy,
        { provide: ConfigService, useValue: { get: () => secret } },
        { provide: AuthService, useValue: { validateUser: async (id: string) => ({ id, role: id.split('-')[0] }) } },
        { provide: NotificationSettingsService, useValue: settings },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => jest.clearAllMocks());

  it.each(['GET', 'PATCH'] as const)('rejects anonymous %s requests', async (method) => {
    const response = await app.inject({ method, url: '/admin/notifications' });
    expect(response.statusCode).toBe(401);
    expect(settings.getSettings).not.toHaveBeenCalled();
    expect(settings.update).not.toHaveBeenCalled();
  });

  it.each(['client', 'organizer', 'scanner'])('denies reading and changing settings as %s', async (role) => {
    for (const method of ['GET', 'PATCH'] as const) {
      const response = await app.inject({ method, url: '/admin/notifications', headers: { authorization: `Bearer ${token(role)}` } });
      expect(response.statusCode).toBe(403);
    }
    expect(settings.getSettings).not.toHaveBeenCalled();
    expect(settings.update).not.toHaveBeenCalled();
  });

  it('allows the administrator to read and save valid preferences', async () => {
    const headers = { authorization: `Bearer ${token('admin')}` };
    expect((await app.inject({ method: 'GET', url: '/admin/notifications', headers })).statusCode).toBe(200);
    const payload = { version: 1, changes: [{ key: 'welcome_email', enabled: false }] };
    expect((await app.inject({ method: 'PATCH', url: '/admin/notifications', headers, payload })).statusCode).toBe(200);
    expect(settings.update).toHaveBeenCalledWith(payload, 'admin-1');
  });

  it('validates nested values and rejects attempts to add arbitrary configuration', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/admin/notifications', headers: { authorization: `Bearer ${token('admin')}` }, payload: { version: 1, changes: [{ key: 'welcome_email', enabled: 'false', recipient: 'another@example.com' }] } });
    expect(response.statusCode).toBe(400);
    expect(settings.update).not.toHaveBeenCalled();
  });
});
