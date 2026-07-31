import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from 'generated/raw-db-client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Something went wrong';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();
            if (typeof res === 'string') {
                message = res;
            } else {
                const body = res as Record<string, unknown>;
                const msg = body?.message as string | string[] | undefined;
                message = Array.isArray(msg)
                    ? String(msg[0])
                    : msg != null
                      ? String(msg)
                      : message;
            }
        } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            if (exception.code === 'P2002') {
                status = HttpStatus.CONFLICT;
                message = 'Record already exists';
            } else if (exception.code === 'P2025') {
                status = HttpStatus.NOT_FOUND;
                message = 'Record not found';
            } else {
                message = `Database error (${exception.code})`;
            }
        }

        response.status(status).json({
            success: false,
            message,
        });
    }
}
