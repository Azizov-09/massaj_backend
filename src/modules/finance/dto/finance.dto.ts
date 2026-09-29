import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class RecordPaymentDto {
  @IsUUID() parentId!: string;
  @IsUUID() childId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(2_000_000_000) amount!: number;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsOptional() @IsString() @Length(1, 1000) note?: string;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() @Length(8, 255) idempotencyKey?: string;
}

export class RefundDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(2_000_000_000) amount!: number;
  @IsOptional() @IsString() @Length(1, 1000) note?: string;
}

export class FinanceQueryDto {
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsUUID() childId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 50;
}
