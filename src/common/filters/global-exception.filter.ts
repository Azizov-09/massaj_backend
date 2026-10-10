import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp(); const response = context.getResponse<Response>(); const request = context.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const detail = typeof exceptionResponse === 'object' && exceptionResponse !== null ? exceptionResponse : { message: exceptionResponse ?? 'Internal server error' };
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${exception instanceof Error ? exception.message : 'Unknown error'}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    response.status(status).json({ statusCode: status, timestamp: new Date().toISOString(), path: request.url, ...detail });
  }
}
