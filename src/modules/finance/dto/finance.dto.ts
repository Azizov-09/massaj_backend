import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class RecordPaymentDto {
  @ApiProperty({ description: 'Parent paying UUID' })
  @IsUUID()
  parentId!: string;

  @ApiProperty({ description: 'Child benefiting UUID' })
  @IsUUID()
  childId!: string;

  @ApiProperty({ description: 'Payment amount in smallest currency unit (e.g. tiyin)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, description: 'Method of payment' })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({ description: 'Payment note or transaction memo' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;

  @ApiPropertyOptional({ description: 'Timestamp when payment was received (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional({ description: 'Unique idempotency key to prevent double charge' })
  @IsOptional()
  @IsString()
  @Length(8, 255)
  idempotencyKey?: string;
}

export class RefundDto {
  @ApiProperty({ description: 'Refund amount in smallest currency unit' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  amount!: number;

  @ApiPropertyOptional({ description: 'Reason or note for refund' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;
}

export class FinanceQueryDto {
  @ApiPropertyOptional({ description: 'Filter by parent UUID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Filter by child UUID' })
  @IsOptional()
  @IsUUID()
  childId?: string;

  @ApiPropertyOptional({ description: 'Start date filter (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit = 50;
}
