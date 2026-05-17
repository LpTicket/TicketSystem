import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * GoogleStrategy
 * Handles Google OAuth 2.0 authentication.
 * Extends PassportStrategy to integrate with NestJS's AuthGuard system.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    
    // Fallback to a production-ready Render URL if APP_URL is missing
    const apiUrl = configService.get<string>('API_URL') || 'https://ticketsystembackend-102j.onrender.com';
    
    /**
     * Safety check:
     * In development, GOOGLE_CLIENT_ID might be missing or contain "placeholder".
     * We use dummy strings to allow the application to boot without crashing,
     * though Google login will fail in the browser until real keys are provided.
     */
    const finalID = (!clientID || clientID.includes('placeholder')) ? 'local-placeholder-id' : clientID;
    const finalSecret = (!clientSecret || clientSecret.includes('placeholder')) ? 'local-placeholder-secret' : clientSecret;

    console.log('Initializing GoogleStrategy with ID:', finalID === 'local-placeholder-id' ? 'MISSING (Local Placeholder)' : 'OK');
    
    super({
      clientID: finalID,
      clientSecret: finalSecret,
      callbackURL: `${apiUrl}/api/auth/google/callback`,
      scope: ['email', 'profile'],
    } as any);
  }

  /**
   * validate
   * Callback executed after Google returns a successful user profile.
   * Transforms raw Google profile data into our internal User object format.
   * 
   * @param accessToken Token used to access Google APIs if needed later
   * @param refreshToken Token used to refresh the session
   * @param profile Raw profile data from Google
   * @param done Passport callback to continue the auth flow
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    
    // Normalize user data with defensive fallbacks for missing google profile details
    const user = {
      email: emails && emails[0] ? emails[0].value : '',
      firstName: (name && name.givenName) ? name.givenName : (profile.displayName || 'Usuario'),
      lastName: (name && name.familyName) ? name.familyName : '',
      picture: (photos && photos[0]) ? photos[0].value : null,
      accessToken,
    };
    
    done(null, user);
  }
}
