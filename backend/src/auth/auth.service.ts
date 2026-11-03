import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException, NotFoundException, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { decode, verify, type JwtPayload } from 'jsonwebtoken';
import { User, UserRole } from '../database/entities';
import { RegisterDto, LoginDto, UpdateProfileDto } from './dto/auth.dto';
import { ConfigService } from '@nestjs/config';
import { MarketingService } from '../marketing/marketing.service';
import { MailService } from '../common/services/mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private appleKeys?: { expiresAt: number; keys: (crypto.JsonWebKey & { kid?: string; alg?: string; use?: string })[] };

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly marketingService: MarketingService,
    private readonly mailService: MailService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async register(dto: RegisterDto, platform: 'web' | 'app' = 'web', ip?: string) {
    const existingEmail = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictException('El email ya está registrado');

    const existingUser = await this.userRepo.findOne({ where: { username: dto.username } });
    if (existingUser) throw new ConflictException('El usuario ya está en uso');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      idType: (dto.idType as any) || 'V',
      idNumber: dto.idNumber,
      phone: dto.phone,
      address: dto.address,
      // SECURITY: never trust a client-supplied role. Self-registration is
      // always a CLIENT; elevating to admin is an admin-only operation.
      role: UserRole.CLIENT,
    });

    const saved = await this.userRepo.save(user);

    // Fire-and-forget welcome messages. Never block registration.
    if (saved.phone) {
      this.marketingService.sendWelcomeWhatsapp(saved.phone, saved.firstName, dto.lang).catch(() => {});
    }
    if (saved.email) {
      this.mailService.sendWelcomeEmail(saved.email, saved.firstName, dto.lang).catch(() => {});
    }
    this.mailService
      .sendAdminNewUserNotification(
        { firstName: saved.firstName, lastName: saved.lastName, email: saved.email, phone: saved.phone },
        platform,
        'Email',
        ip,
      )
      .catch(() => {});

    return this.generateTokens(saved);
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const result = this.generateTokens(user);
    void this.notifyLogin(user, 'Email');
    return result;
  }

  async getProfile(userId: string) {
    const cacheKey = `profile:${userId}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const { passwordHash, ...profile } = user;
    // Route base64 avatar to a dedicated endpoint to avoid sending 600kB on every profile fetch
    const result = {
      ...profile,
      avatarUrl: profile.avatarUrl?.startsWith('data:') ? `/api/auth/avatar/${userId}` : profile.avatarUrl,
    };
    await this.cache.set(cacheKey, result, 60_000);
    return result;
  }

  async getAvatarById(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['avatarUrl'] });
    const raw = user?.avatarUrl;
    if (!raw?.startsWith('data:')) return null;
    const match = raw.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) return null;
    return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
  }

  async invalidateProfileCache(userId: string) {
    await this.cache.del(`profile:${userId}`);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.email) {
      const existingEmail = await this.userRepo.findOne({ where: { email: dto.email } });
      if (existingEmail && existingEmail.id !== userId) throw new ConflictException('El email ya está registrado');
    }
    if (dto.username) {
      const existingUser = await this.userRepo.findOne({ where: { username: dto.username } });
      if (existingUser && existingUser.id !== userId) throw new ConflictException('El usuario ya está en uso');
    }
    const updateData: any = { ...dto };
    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 12);
      delete updateData.password;
    }
    
    await this.userRepo.update(userId, updateData);
    await this.invalidateProfileCache(userId);
    return this.getProfile(userId);
  }

  async deleteAccount(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const suffix = user.id.replace(/-/g, '').slice(0, 24);
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

    await this.userRepo.update(userId, {
      email: `deleted-${suffix}@deleted.lpticket.local`,
      username: `deleted_${suffix}`.slice(0, 40),
      firstName: 'Deleted',
      lastName: 'Account',
      phone: null,
      address: null,
      avatarUrl: null,
      passwordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      isActive: false,
    } as any);

    await this.invalidateProfileCache(userId);

    return { success: true };
  }

  async validateAppleMobileUser(body: { identityToken: string; email?: string; firstName?: string; lastName?: string }, ip?: string) {
    const { identityToken, firstName, lastName } = body;
    if (typeof identityToken !== 'string' || identityToken.length > 16_384) {
      throw new UnauthorizedException('Invalid Apple identity token');
    }

    let appleEmail: string;
    try {
      const decoded = decode(identityToken, { complete: true });
      const algorithm = decoded?.header.alg;
      const kid = decoded?.header.kid;
      if (!kid || (algorithm !== 'RS256' && algorithm !== 'ES256')) throw new Error('Invalid Apple header');

      // Fetch only Apple's fixed HTTPS endpoint; never use a URL supplied by a token.
      if (!this.appleKeys || this.appleKeys.expiresAt <= Date.now()
        || !this.appleKeys.keys.some((key) => key.kid === kid)) {
        const response = await fetch('https://appleid.apple.com/auth/keys', { signal: AbortSignal.timeout(5_000) });
        if (!response.ok) throw new Error('Apple keys unavailable');
        const document = await response.json() as { keys?: (crypto.JsonWebKey & { kid?: string; alg?: string; use?: string })[] };
        if (!Array.isArray(document.keys) || !document.keys.length) throw new Error('Invalid Apple keys');
        this.appleKeys = { keys: document.keys, expiresAt: Date.now() + 15 * 60_000 };
      }
      const jwk = this.appleKeys.keys.find((key) => key.kid === kid && key.alg === algorithm && key.use === 'sig');
      if (!jwk) throw new Error('Unknown Apple signing key');
      const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
      const claims = verify(identityToken, key, {
        algorithms: [algorithm],
        issuer: 'https://appleid.apple.com',
        audience: 'com.inhoustontexas.lpticket',
      }) as JwtPayload;
      if (!claims.sub || !Number.isFinite(claims.exp)
        || (claims.email_verified !== true && claims.email_verified !== 'true')
        || typeof claims.email !== 'string' || !claims.email.trim()) {
        throw new Error('Missing verified Apple identity');
      }
      // A client-provided email must never select the account to authenticate.
      appleEmail = claims.email.trim().toLowerCase();
    } catch {
      throw new UnauthorizedException('Invalid Apple identity token');
    }

    let user = await this.userRepo.findOne({ where: { email: appleEmail } });
    const isNewUser = !user;
    if (!user) {
      user = this.userRepo.create({
        email: appleEmail,
        username: appleEmail.split('@')[0] + '_' + crypto.randomInt(1000),
        firstName: firstName || 'Apple',
        lastName: lastName || 'User',
        role: UserRole.CLIENT,
        isActive: true,
      });
      user = await this.userRepo.save(user);
      this.mailService
        .sendAdminNewUserNotification(
          { firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone },
          'app',
          'Apple',
          ip,
        )
        .catch(() => {});
    }

    if (!user.isActive) throw new UnauthorizedException('Inactive user');
    const result = this.generateTokens(user);
    if (!isNewUser) void this.notifyLogin(user, 'Apple');
    return result;
  }

  async validateOAuthUser(profile: any, platform: 'web' | 'app' = 'web', provider: string = 'Google', ip?: string) {
    const { email, firstName, lastName } = profile;
    let user = await this.userRepo.findOne({ where: { email } });
    const isNewUser = !user;

    if (!user) {
      // Create new user if not exists
      user = this.userRepo.create({
        email,
        username: email.split('@')[0] + '_' + crypto.randomInt(1000),
        firstName,
        lastName,
        role: UserRole.CLIENT,
        isActive: true,
      });
      user = await this.userRepo.save(user);
      this.mailService
        .sendAdminNewUserNotification(
          { firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone },
          platform,
          provider,
          ip,
        )
        .catch(() => {});
    }

    const result = this.generateTokens(user);
    if (!isNewUser) void this.notifyLogin(user, provider);
    return result;
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId, isActive: true } });
  }

  async startSupportSession(adminId: string, userId: string) {
    const admin = await this.validateUser(adminId);
    if (admin?.role !== UserRole.ADMIN) throw new ForbiddenException('Solo un administrador puede abrir esta sesión');

    const user = await this.validateUser(userId);
    if (!user) throw new NotFoundException('Usuario activo no encontrado');
    if (user.role !== UserRole.CLIENT) throw new ForbiddenException('Solo se pueden abrir cuentas de clientes');

    const accessToken = this.jwtService.sign(
      { sub: user.id, actorId: admin.id, purpose: 'support', role: UserRole.CLIENT },
      { expiresIn: '1h' },
    );
    this.logger.log(`Support session started actor=${admin.id} user=${user.id}`);
    const { passwordHash, ...userData } = user;
    return { accessToken, user: userData, expiresIn: 3600 };
  }

  private getRefreshSecret(): string {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not set. Refusing to issue or verify refresh tokens with an insecure default.');
    }
    return secret;
  }

  async refreshSession(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.getRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // A support access token must never be exchangeable for a full client session,
    // even if an installation happens to use the same secret for both token types.
    if (payload.purpose || payload.actorId) {
      throw new UnauthorizedException('Una sesión de soporte no puede renovarse');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub, isActive: true } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    return this.generateTokens(user);
  }

  async forgotPassword(email: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    // Always return success to avoid email enumeration
    if (!user) return { success: true };

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.userRepo.update(user.id, {
      resetPasswordToken: tokenHash,
      resetPasswordExpires: expiresAt,
    } as any);

    const appUrl = (this.configService.get<string>('APP_URL') || 'https://www.lpticket.com').replace(/\/$/, '');
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    await this.mailService.sendPasswordResetEmail(user.email, user.firstName, resetUrl).catch(() => {});
    return { success: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.userRepo.findOne({
      where: { resetPasswordToken: tokenHash } as any,
    });

    if (!user) throw new BadRequestException('Token inválido o ya utilizado');
    const expires = (user as any).resetPasswordExpires as Date | null;
    if (!expires || new Date() > expires) {
      throw new BadRequestException('El token ha expirado. Solicita uno nuevo.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(user.id, {
      passwordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    } as any);

    return { success: true };
  }

  private async notifyLogin(user: User, provider: string) {
    // Delivery must never block or invalidate an authenticated session.
    try {
      await this.mailService.sendLoginNotifications(user, provider);
    } catch {
      this.logger.warn('No se pudo entregar el aviso de inicio de sesión');
    }
  }

  private generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.getRefreshSecret(),
      expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d') as any,
    });

    const { passwordHash, ...userData } = user;
    return {
      accessToken,
      refreshToken,
      user: userData,
    };
  }
}
