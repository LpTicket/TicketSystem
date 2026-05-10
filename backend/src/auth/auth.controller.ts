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
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nest-lab/fastify-multer';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, UpdateProfileDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Request() req: any) {
    // This initiates the Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Request() req: any, @Res() res: any) {
    const result = await this.authService.validateOAuthUser(req.user);
    
    // Redirect to frontend with tokens in URL
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://ticketsystem-jzgf.onrender.com';
    const redirectUrl = `${frontendUrl}/login/success?token=${result.accessToken}&refreshToken=${result.refreshToken}`;
    
    return res.redirect(redirectUrl);
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
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, 'avatar-' + uniqueSuffix + extname(file.originalname));
        },
      }) as any,
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(new Error('Solo se permiten imágenes'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    }),
  )
  uploadAvatar(@Request() req: any, @UploadedFile() file: any) {
    return this.authService.updateProfile(req.user.id, { avatarUrl: file.filename });
  }
}
