import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const apiUrl = configService.get<string>('API_URL') || 'https://ticketsystembackend-102j.onrender.com';
    
    // Safety check to prevent crash on local startup without keys
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

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const user = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos[0].value,
      accessToken,
    };
    done(null, user);
  }
}
