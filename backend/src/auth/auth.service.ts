import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../database/entities';
import { RegisterDto, LoginDto, UpdateProfileDto } from './dto/auth.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
      role: dto.role || UserRole.CLIENT,
    });

    const saved = await this.userRepo.save(user);
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

  async validateUser(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId, isActive: true } });
  }

  private generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'fallback-refresh-secret-for-production-please-change-it',
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
