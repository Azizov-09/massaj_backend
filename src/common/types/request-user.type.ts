import { Role } from '@prisma/client';

export interface RequestUser { id: string; role: Role; tokenVersion: number; sessionId?: string; }
