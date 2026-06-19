import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const isMobile = request.query?.platform === 'mobile';
    return isMobile ? { state: 'mobile' } : {};
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const response = context.switchToHttp().getResponse();

    // Fastify to Express compatibility shim for Passport
    if (!response.setHeader && response.raw) {
      response.setHeader = (name: string, value: any) => {
        response.raw.setHeader(name, value);
      };
    }

    if (!response.end && response.raw) {
      response.end = (chunk: any) => {
        response.raw.end(chunk);
      };
    }

    const result = (await super.canActivate(context)) as boolean;
    return result;
  }
}
