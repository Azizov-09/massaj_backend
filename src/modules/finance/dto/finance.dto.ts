import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class RecordPaymentDto {
  @ApiProperty({ description: 'Parent profile UUID (a User UUID is also resolved for backward compatibility)' })
  @IsUUID()
  parentId!: string;

  @ApiProperty({ description: 'Child benefiting UUID' })
  @IsUUID()
  childId!: string;

  @ApiProperty({ description: 'Positive whole amount in UZS; do not multiply by 100' })
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

  @ApiProperty({ description: 'Client-generated unique idempotency key; reuse only when retrying the same request' })
  @IsString()
  @Length(8, 255)
  idempotencyKey!: string;
}

export class RefundDto {
  @ApiProperty({ description: 'Positive whole refund amount in UZS; do not multiply by 100' })
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

  @ApiProperty({ description: 'Client-generated unique idempotency key for this refund request' })
  @IsString()
  @Length(8, 255)
  idempotencyKey!: string;
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
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

export class RecordChargeDto {
  @ApiProperty({ description: 'Parent profile UUID responsible for payment' })
  @IsUUID()
  parentId!: string;

  @ApiPropertyOptional({ description: 'Child benefiting UUID' })
  @IsOptional()
  @IsUUID()
  childId?: string;

  @ApiPropertyOptional({ description: 'Completed appointment UUID; prevents charging the same session twice' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiProperty({ description: 'Charge amount in UZS' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  amount!: number;

  @ApiProperty({ description: 'Description of the charged medical/rehab service' })
  @IsString()
  @Length(2, 500)
  description!: string;

  @ApiProperty({ description: 'Client-generated unique idempotency key for this charge request' })
  @IsString()
  @Length(8, 255)
  idempotencyKey!: string;
}
