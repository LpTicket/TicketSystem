import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    console.error('DETAILED ERROR:', exception);

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      response.status(status).send(
        typeof res === 'string' ? { statusCode: status, message: res } : res,
      );
    } else {
      response.status(status).send({
        statusCode: status,
        message: exception instanceof Error ? exception.message : 'Internal server error',
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  }
}
