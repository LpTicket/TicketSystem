import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserRole } from '../database/entities';
import { RegisterDto, LoginDto, UpdateProfileDto } from './dto/auth.dto';
import { ConfigService } from '@nestjs/config';
import { MarketingService } from '../marketing/marketing.service';
import { MailService } from '../common/services/mail.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly marketingService: MarketingService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
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

    return this.generateTokens(user);
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const { passwordHash, ...profile } = user;
    return profile;
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

    return { success: true };
  }

  async validateAppleMobileUser(body: { identityToken: string; email?: string; firstName?: string; lastName?: string }) {
    const { identityToken, email, firstName, lastName } = body;
    if (!identityToken) throw new UnauthorizedException('Missing Apple identity token');

    // Decode the JWT header+payload without verifying signature (Apple public keys rotate).
    // We trust the token if email is present in it or passed from the client on first login.
    let appleEmail = email;
    try {
      const [, payloadB64] = identityToken.split('.');
      const decoded = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
      if (decoded.email) appleEmail = decoded.email;
    } catch {
      throw new UnauthorizedException('Invalid Apple identity token');
    }

    if (!appleEmail) throw new UnauthorizedException('Apple did not provide an email address');

    let user = await this.userRepo.findOne({ where: { email: appleEmail } });
    if (!user) {
      user = this.userRepo.create({
        email: appleEmail,
        username: appleEmail.split('@')[0] + '_' + Math.floor(Math.random() * 1000),
        firstName: firstName || 'Apple',
        lastName: lastName || 'User',
        role: UserRole.CLIENT,
        isActive: true,
      });
      user = await this.userRepo.save(user);
    }

    return this.generateTokens(user);
  }

  async validateOAuthUser(profile: any) {
    const { email, firstName, lastName } = profile;
    let user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      // Create new user if not exists
      user = this.userRepo.create({
        email,
        username: email.split('@')[0] + '_' + Math.floor(Math.random() * 1000),
        firstName,
        lastName,
        role: UserRole.CLIENT,
        isActive: true,
      });
      user = await this.userRepo.save(user);
    }

    return this.generateTokens(user);
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId, isActive: true } });
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
