import { Type } from 'class-transformer';
import { IsOptional, IsString, Max, Min } from 'class-validator';
export class CompleteSessionDto { @IsOptional() @IsString() @Max(2000) note?: string; @IsOptional() @IsString() @Max(5000) observation?: string; @IsOptional() @IsString() @Max(5000) recommendation?: string; }
export class CancelSessionDto { @IsOptional() @IsString() @Max(1000) note?: string; }
export class SessionQueryDto { @IsOptional() @IsString() childId?: string; @IsOptional() @Type(() => Number) @Min(1) page = 1; @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 20; }
