import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(JwtStrategy.name);
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not set. Refusing to start with an insecure default.');
    }
    super({
      // Look for the token in 'Authorization: Bearer <token>' or query parameter '?token=<token>'
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
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
  async validate(req: { method: string; url: string }, payload: { sub: string; email?: string; role: string; actorId?: string; purpose?: string }) {
    // sub contains the unique user UUID
    const user = await this.authService.validateUser(payload.sub);
    
    if (!user) {
      // If user was deleted but still has a valid token
      throw new UnauthorizedException('User no longer exists or session is invalid');
    }

    if (payload.purpose === 'support') {
      const actor = payload.actorId && await this.authService.validateUser(payload.actorId);
      if (!actor || actor.role !== 'admin' || user.role !== 'client') {
        throw new UnauthorizedException('Sesión de soporte inválida');
      }
      const path = req.url.split('?')[0];
      this.logger.log(`Support access actor=${actor.id} user=${user.id} method=${req.method} path=${path}`);
      return { id: user.id, email: user.email, role: user.role, supportActorId: actor.id };
    }
    if (payload.purpose || payload.actorId) throw new UnauthorizedException('Sesión inválida');

    // Return relevant user metadata for route-based authorization
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
