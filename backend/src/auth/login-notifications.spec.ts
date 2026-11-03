import { AuthService } from './auth.service';
jest.mock('bcrypt', () => ({ compare: jest.fn().mockResolvedValue(true) }));

describe('Sign-in notification triggers', () => {
  const setup = () => {
    const user = { id: 'user-1', email: 'buyer@example.com', passwordHash: 'hashed', isActive: true };
    const repo = { findOne: jest.fn().mockResolvedValue(user), create: jest.fn((value) => value), save: jest.fn(async (value) => ({ ...value, id: 'new-user' })) };
    const mail = { sendLoginNotifications: jest.fn().mockResolvedValue(undefined), sendAdminNewUserNotification: jest.fn().mockResolvedValue(undefined) };
    const jwt = { verify: jest.fn().mockReturnValue({ sub: user.id }) };
    const service = new AuthService(repo as any, jwt as any, { get: () => 'tests-only-refresh-secret' } as any, {} as any, mail as any, {} as any);
    jest.spyOn(service as any, 'generateTokens').mockReturnValue({ accessToken: 'test-token' });
    return { service, repo, mail, user };
  };

  it('notifies a successful password login without changing its response', async () => {
    const { service, mail, user } = setup();
    expect(await service.login({ email: user.email, password: 'test-only' })).toEqual({ accessToken: 'test-token' });
    expect(mail.sendLoginNotifications).toHaveBeenCalledWith(user, 'Email');
  });

  it('keeps authentication successful if delivery fails', async () => {
    const { service, mail, user } = setup();
    mail.sendLoginNotifications.mockRejectedValue(new Error('SMTP unavailable'));
    expect(await service.login({ email: user.email, password: 'test-only' })).toEqual({ accessToken: 'test-token' });
  });

  it('does not notify failed login attempts', async () => {
    const { service, repo, mail } = setup();
    repo.findOne.mockResolvedValue(null);
    await expect(service.login({ email: 'unknown@example.com', password: 'test-only' })).rejects.toThrow('Credenciales inválidas');
    expect(mail.sendLoginNotifications).not.toHaveBeenCalled();
  });

  it.each(['Google', 'Facebook'])('notifies existing %s users on sign-in', async (provider) => {
    const { service, mail, user } = setup();
    await service.validateOAuthUser(user, 'web', provider);
    expect(mail.sendLoginNotifications).toHaveBeenCalledWith(user, provider);
  });

  it('keeps new OAuth registration distinct from an existing-account login', async () => {
    const { service, repo, mail, user } = setup();
    repo.findOne.mockResolvedValue(null);
    await service.validateOAuthUser(user, 'web', 'Google');
    expect(mail.sendAdminNewUserNotification).toHaveBeenCalled();
    expect(mail.sendLoginNotifications).not.toHaveBeenCalled();
  });

  it('does not send login alerts when refreshing an existing session', async () => {
    const { service, mail } = setup();
    await service.refreshSession('test-only-refresh-token');
    expect(mail.sendLoginNotifications).not.toHaveBeenCalled();
  });
});
