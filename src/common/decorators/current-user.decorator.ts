import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '../types/request-user.type';
export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): RequestUser =>
  context.switchToHttp().getRequest<Request & { user: RequestUser }>().user,
);
