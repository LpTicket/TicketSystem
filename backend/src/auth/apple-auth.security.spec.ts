import { generateKeyPairSync } from 'crypto';
import { sign } from 'jsonwebtoken';
import { AuthService } from './auth.service';

describe('Apple identity verification', () => {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const stranger = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'apple-test-key';
  const publicJwk = { ...pair.publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' };
  const validClaims = {
    sub: 'verified-apple-subject', email: 'owner@example.test', email_verified: 'true',
    iss: 'https://appleid.apple.com', aud: 'com.inhoustontexas.lpticket',
    exp: Math.floor(Date.now() / 1000) + 300,
  };
  let service: AuthService;
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let issueTokens: jest.SpyInstance;
  let fetchKeys: jest.SpyInstance;
  const token = (claims = {}, key = pair.privateKey) => sign(
    Object.fromEntries(Object.entries({ ...validClaims, ...claims }).filter(([, value]) => value !== undefined)),
    key, { algorithm: 'RS256', keyid: kid },
  );

  beforeEach(() => {
    repo = { findOne: jest.fn().mockResolvedValue({ id: 'user-1', email: validClaims.email, isActive: true }), create: jest.fn(), save: jest.fn() };
    service = new AuthService(repo as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    issueTokens = jest.spyOn(service as any, 'generateTokens').mockReturnValue({ accessToken: 'test-access-token' });
    fetchKeys = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ keys: [publicJwk] }) } as Response);
  });
  afterEach(() => jest.restoreAllMocks());

  it('uses the signed email instead of a client-supplied account', async () => {
    await expect(service.validateAppleMobileUser({ identityToken: token(), email: 'another@example.test' })).resolves.toEqual({ accessToken: 'test-access-token' });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { email: validClaims.email } });
    expect(fetchKeys).toHaveBeenCalledWith('https://appleid.apple.com/auth/keys', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it.each([
    ['wrong audience', { aud: 'another.application' }],
    ['wrong issuer', { iss: 'https://untrusted.example' }],
    ['expired token', { exp: 1 }],
    ['missing expiry', { exp: undefined }],
    ['unverified email', { email_verified: false }],
    ['missing signed email', { email: undefined }],
    ['missing subject', { sub: undefined }],
  ])('rejects %s before looking up an account', async (_label, claims) => {
    await expect(service.validateAppleMobileUser({ identityToken: token(claims as any), email: 'owner@example.test' })).rejects.toThrow('Invalid Apple identity token');
    expect(repo.findOne).not.toHaveBeenCalled();
    expect(issueTokens).not.toHaveBeenCalled();
  });

  it('rejects a forged signature even when the email names an existing account', async () => {
    await expect(service.validateAppleMobileUser({ identityToken: token({}, stranger.privateKey) })).rejects.toThrow('Invalid Apple identity token');
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('rejects unsigned and symmetric tokens', async () => {
    for (const forged of [sign(validClaims, '', { algorithm: 'none' }), sign(validClaims, 'test-hmac-key', { algorithm: 'HS256', keyid: kid })]) {
      await expect(service.validateAppleMobileUser({ identityToken: forged })).rejects.toThrow('Invalid Apple identity token');
    }
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('fails closed if Apple keys cannot be retrieved', async () => {
    fetchKeys.mockRejectedValue(new Error('Network unavailable'));
    await expect(service.validateAppleMobileUser({ identityToken: token() })).rejects.toThrow('Invalid Apple identity token');
    expect(issueTokens).not.toHaveBeenCalled();
  });

  it('reuses fetched public keys for repeated legitimate logins', async () => {
    await service.validateAppleMobileUser({ identityToken: token() });
    await service.validateAppleMobileUser({ identityToken: token() });
    expect(fetchKeys).toHaveBeenCalledTimes(1);
  });

  it('does not issue a session for an inactive account', async () => {
    repo.findOne.mockResolvedValue({ id: 'inactive', isActive: false });
    await expect(service.validateAppleMobileUser({ identityToken: token() })).rejects.toThrow('Inactive user');
    expect(issueTokens).not.toHaveBeenCalled();
  });
});
