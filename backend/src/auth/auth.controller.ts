import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { FacebookAuthGuard } from './guards/facebook-auth.guard';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nest-lab/fastify-multer';
import { memoryStorage } from 'multer';
import { AuthService } from './auth.service';
import { StorageService } from '../common/services/storage.service';
import { RegisterDto, LoginDto, UpdateProfileDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refreshSession(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshSession(refreshToken);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth(@Request() req: any) {
    // This initiates the Google OAuth flow
    // Pass ?platform=mobile to get a deep link redirect back
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Request() req: any, @Res() res: any) {
    try {
      const result = await this.authService.validateOAuthUser(req.user);
      const frontendUrl =
        this.configService.get('FRONTEND_URL') ||
        this.configService.get('APP_URL') ||
        'https://ticketsystem-jzgf.onrender.com';

      // If the OAuth flow was initiated from the mobile app (?platform=mobile
      // or state contains "mobile"), redirect to the deep link scheme instead.
      const state = req.query?.state || '';
      const isMobile = state.includes('mobile') || req.query?.platform === 'mobile';

      const redirectUrl = isMobile
        ? `lpticket://login/success?token=${result.accessToken}&refreshToken=${result.refreshToken}`
        : `${frontendUrl}/login/success?token=${result.accessToken}&refreshToken=${result.refreshToken}`;

      return res.status(302).redirect(redirectUrl);
    } catch (error) {
      console.error('Error in Google Redirect:', error);
      const frontendUrl =
        this.configService.get('FRONTEND_URL') ||
        this.configService.get('APP_URL') ||
        'https://ticketsystem-jzgf.onrender.com';
      return res.status(302).redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }

  @Get('facebook')
  @UseGuards(FacebookAuthGuard)
  async facebookAuth(@Request() req: any) {
    // This initiates the Facebook OAuth flow
  }

  @Get('facebook/callback')
  @UseGuards(FacebookAuthGuard)
  async facebookAuthRedirect(@Request() req: any, @Res() res: any) {
    try {
      const result = await this.authService.validateOAuthUser(req.user);
      const frontendUrl =
        this.configService.get('APP_URL') ||
        this.configService.get('FRONTEND_URL') ||
        'https://ticketsystem-jzgf.onrender.com';

      const state = req.query?.state || '';
      const isMobile = state.includes('mobile') || req.query?.platform === 'mobile';

      const redirectUrl = isMobile
        ? `lpticket://login/success?token=${result.accessToken}&refreshToken=${result.refreshToken}`
        : `${frontendUrl}/login/success?token=${result.accessToken}&refreshToken=${result.refreshToken}`;

      return res.status(302).redirect(redirectUrl);
    } catch (error) {
      console.error('Error in Facebook Redirect:', error);
      const frontendUrl = this.configService.get('APP_URL') || 'https://ticketsystem-jzgf.onrender.com';
      return res.status(302).redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('profile/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage() as any,
      fileFilter: (_req: any, file: any, cb: any) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(new Error('Solo se permiten imágenes'), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadAvatar(@Request() req: any, @UploadedFile() file: any) {
    const avatarUrl = await this.storageService.uploadFile(file, 'avatars');
    return this.authService.updateProfile(req.user.id, { avatarUrl });
  }
}
