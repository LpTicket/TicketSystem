import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private configService: ConfigService) {
    const apiUrl = configService.get<string>('API_URL') || 'https://ticketsystembackend-102j.onrender.com';
    
    const clientID = configService.get<string>('FACEBOOK_APP_ID');
    const clientSecret = configService.get<string>('FACEBOOK_APP_SECRET');

    const finalID = (!clientID || clientID.includes('placeholder')) ? 'local-fb-id' : clientID;
    const finalSecret = (!clientSecret || clientSecret.includes('placeholder')) ? 'local-fb-secret' : clientSecret;

    super({
      clientID: finalID,
      clientSecret: finalSecret,
      callbackURL: `${apiUrl}/api/auth/facebook/callback`,
      scope: ['email', 'public_profile'],
      profileFields: ['emails', 'name', 'photos'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    
    const email = emails && emails[0] && emails[0].value
      ? emails[0].value
      : `${profile.id}@facebook.com`;

    const firstName = name && name.givenName ? name.givenName : 'Usuario';
    const lastName = name && name.familyName ? name.familyName : 'Facebook';
    
    const picture = photos && photos[0] && photos[0].value
      ? photos[0].value
      : '';

    const user = {
      email,
      firstName,
      lastName,
      picture,
      accessToken,
    };
    done(null, user);
  }
}
