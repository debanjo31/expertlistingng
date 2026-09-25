import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ExceptionBody {
  error?: string;
  message?: string | string[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const body: ExceptionBody =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : {};

    if (!isHttpException) {
      const stack =
        exception instanceof Error ? exception.stack : String(exception);
      this.logger.error('Unhandled request error', stack);
    }

    response.status(status).json({
      statusCode: status,
      error: body.error ?? this.errorName(status),
      message:
        body.message ??
        (typeof exceptionResponse === 'string'
          ? exceptionResponse
          : 'Internal server error'),
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }

  private errorName(status: number): string {
    const name = HttpStatus[status];
    if (typeof name !== 'string') {
      return 'Error';
    }

    return name
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
}
