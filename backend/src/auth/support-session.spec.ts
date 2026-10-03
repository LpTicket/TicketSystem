import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { UserRole } from '../database/entities';
import { RolesGuard } from '../common/guards/roles.guard';

const admin = { id: 'admin-1', email: 'admin@example.com', role: UserRole.ADMIN, isActive: true };
const client = { id: 'client-1', email: 'client@example.com', role: UserRole.CLIENT, isActive: true, firstName: 'Ana', lastName: 'Test', passwordHash: 'secret' };

describe('Web support sessions', () => {
  const authService = {
    validateUser: jest.fn(async (id: string) => id === admin.id ? admin : id === client.id ? client : null),
    updateProfile: jest.fn(async () => client),
  };
  const strategy = new JwtStrategy({ get: () => 'a-valid-test-secret' } as any, authService as any);
  const payload = { sub: client.id, actorId: admin.id, purpose: 'support', role: UserRole.CLIENT };

  beforeEach(() => jest.clearAllMocks());

  it('allows client actions, including checkout and payment methods, under the client identity', async () => {
    await expect(strategy.validate({ method: 'GET', url: '/api/orders/my-tickets' }, payload)).resolves.toMatchObject({
      id: client.id, role: UserRole.CLIENT, supportActorId: admin.id,
    });
    await expect(strategy.validate({ method: 'PATCH', url: '/api/auth/profile' }, payload)).resolves.toMatchObject({
      id: client.id, supportActorId: admin.id,
    });
    await expect(strategy.validate({ method: 'POST', url: '/api/orders/checkout' }, payload)).resolves.toMatchObject({
      id: client.id, role: UserRole.CLIENT, supportActorId: admin.id,
    });
    await expect(strategy.validate({ method: 'POST', url: '/api/payments/setup-session' }, payload)).resolves.toMatchObject({
      id: client.id, role: UserRole.CLIENT, supportActorId: admin.id,
    });
    const supportUser = await strategy.validate({ method: 'PATCH', url: '/api/admin/users/client-1/role' }, { ...payload, role: UserRole.ADMIN });
    expect(supportUser).toMatchObject({
      role: UserRole.CLIENT, supportActorId: admin.id,
    });
    const adminGuard = new RolesGuard({ getAllAndOverride: () => [UserRole.ADMIN] } as any);
    expect(adminGuard.canActivate({
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ user: supportUser }) }),
    } as any)).toBe(false);
  });

  it('invalidates support when the actor loses admin rights', async () => {
    authService.validateUser.mockImplementationOnce(async () => client as any).mockImplementationOnce(async () => ({ ...admin, role: UserRole.CLIENT }) as any);
    await expect(strategy.validate({ method: 'GET', url: '/api/auth/profile' }, payload)).rejects.toThrow('inválida');
  });

  it('allows an administrator to update the client profile, including password', async () => {
    const controller = new AuthController(authService as any, {} as any, {} as any);
    await expect(controller.updateProfile(
      { user: { id: client.id, supportActorId: admin.id } }, { password: 'changed-password' },
    )).resolves.toEqual(client);
    expect(authService.updateProfile).toHaveBeenCalledWith(client.id, { password: 'changed-password' });
  });

  it('issues a short-lived token only for an active client', async () => {
    const sign = jest.fn(() => 'support-token');
    const service = new AuthService(
      {} as any, { sign } as any, {} as any, {} as any, {} as any, {} as any,
    );
    jest.spyOn(service, 'validateUser').mockImplementation(async (id: string) => id === admin.id ? admin as any : id === client.id ? client as any : null);
    await expect(service.startSupportSession(admin.id, client.id)).resolves.toMatchObject({
      accessToken: 'support-token', expiresIn: 3600, user: { id: client.id },
    });
    expect(sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: client.id, actorId: admin.id, purpose: 'support' }),
      { expiresIn: '1h' },
    );
    await expect(service.startSupportSession(admin.id, admin.id)).rejects.toThrow('clientes');
    await expect(service.startSupportSession(client.id, client.id)).rejects.toThrow('administrador');
    await expect(service.startSupportSession(admin.id, 'missing-client')).rejects.toThrow('no encontrado');
  });

  it('never exchanges a support token for a regular refresh session', async () => {
    const repository = { findOne: jest.fn() };
    const service = new AuthService(
      repository as any,
      { verify: jest.fn(() => payload) } as any,
      { get: jest.fn(() => 'refresh-secret') } as any,
      {} as any, {} as any, {} as any,
    );
    await expect(service.refreshSession('support-token')).rejects.toThrow('no puede renovarse');
    expect(repository.findOne).not.toHaveBeenCalled();
  });
});
