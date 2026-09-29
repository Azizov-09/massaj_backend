import { AppointmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
export class CreateAppointmentDto { @IsUUID() childId!: string; @IsUUID() parentId!: string; @IsUUID() specialistId!: string; @IsUUID() serviceId!: string; @IsDateString() startAt!: string; @IsDateString() endAt!: string; @IsOptional() @IsString() @Length(1, 2000) notes?: string; }
export class UpdateAppointmentDto { @IsOptional() @IsUUID() specialistId?: string; @IsOptional() @IsUUID() serviceId?: string; @IsOptional() @IsDateString() startAt?: string; @IsOptional() @IsDateString() endAt?: string; @IsOptional() @IsString() @Length(1, 2000) notes?: string; }
export class AppointmentQueryDto { @IsOptional() @IsUUID() childId?: string; @IsOptional() @IsUUID() specialistId?: string; @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus; @IsOptional() @Type(() => Number) @Min(1) page = 1; @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 20; }
