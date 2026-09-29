import { ServiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
export class CreateServiceDto { @IsString() @Length(2, 160) name!: string; @IsOptional() @IsString() @Length(1, 5000) description?: string; @Type(() => Number) @IsInt() @Min(1) @Max(480) durationMinutes!: number; @Type(() => Number) @IsInt() @Min(0) @Max(2_000_000_000) price!: number; }
export class UpdateServiceDto { @IsOptional() @IsString() @Length(2, 160) name?: string; @IsOptional() @IsString() @Length(1, 5000) description?: string; @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(480) durationMinutes?: number; @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2_000_000_000) price?: number; }
export class ServiceQueryDto { @IsOptional() @IsEnum(ServiceStatus) status?: ServiceStatus; }
