import { AuthController } from './auth.controller';

describe('OAuth callback query types', () => {
  it.each(['google', 'facebook'])('%s ignores a non-string state and keeps the web destination', async (provider) => {
    const auth = { validateOAuthUser: jest.fn().mockResolvedValue({ accessToken: 'test-access', refreshToken: 'test-refresh' }) };
    const controller = new AuthController(auth as any, { get: () => 'https://www.lpticket.com' } as any, {} as any);
    const res = { status: jest.fn().mockReturnThis(), redirect: jest.fn() };
    const handler = provider === 'google' ? controller.googleAuthRedirect : controller.facebookAuthRedirect;
    await handler.call(controller, { query: { state: ['mobile', 'unexpected'] }, user: { id: 'verified-user' } }, res);
    expect(auth.validateOAuthUser).toHaveBeenCalledWith({ id: 'verified-user' }, 'web', expect.any(String), undefined);
    expect(res.redirect).toHaveBeenCalledWith('https://www.lpticket.com/login/success?token=test-access&refreshToken=test-refresh');
  });

  it.each(['google', 'facebook'])('%s preserves the existing mobile callback contract', async (provider) => {
    const auth = { validateOAuthUser: jest.fn().mockResolvedValue({ accessToken: 'test-access', refreshToken: 'test-refresh' }) };
    const controller = new AuthController(auth as any, { get: () => 'https://www.lpticket.com' } as any, {} as any);
    const res = { status: jest.fn().mockReturnThis(), redirect: jest.fn() };
    const handler = provider === 'google' ? controller.googleAuthRedirect : controller.facebookAuthRedirect;
    await handler.call(controller, { query: { state: 'mobile' }, user: { id: 'verified-user' } }, res);
    expect(res.redirect).toHaveBeenCalledWith('lpticket://login/success?token=test-access&refreshToken=test-refresh');
  });
});
