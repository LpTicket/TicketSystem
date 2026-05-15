import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

/**
 * JwtStrategy
 * Secures routes by validating Bearer tokens in the Authorization header.
 * This is the primary strategy for all protected API endpoints.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      // Look for the token in 'Authorization: Bearer <token>'
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // CRITICAL: Ensure JWT_SECRET is set in environment variables
      secretOrKey: configService.get<string>('JWT_SECRET') || 'fallback-secret-for-production-please-change-it',
    });
  }

  /**
   * validate
   * Executed automatically by Passport after successfully decoding the JWT.
   * We perform an additional check to ensure the user still exists in our database.
   * 
   * @param payload Decoded content of the JWT
   * @returns An object that becomes accessible via 'req.user' in controllers
   */
  async validate(payload: { sub: string; email: string; role: string }) {
    // sub contains the unique user UUID
    const user = await this.authService.validateUser(payload.sub);
    
    if (!user) {
      // If user was deleted but still has a valid token
      throw new UnauthorizedException('User no longer exists or session is invalid');
    }
    
    // Return relevant user metadata for route-based authorization
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
