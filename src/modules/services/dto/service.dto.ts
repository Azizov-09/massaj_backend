import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ description: 'Service catalog item name', example: 'Therapeutic Pediatric Massage (60 min)' })
  @IsString()
  @Length(2, 160)
  name!: string;

  @ApiPropertyOptional({ description: 'Detailed clinical service description and protocol' })
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  description?: string;

  @ApiProperty({ description: 'Duration in minutes', example: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(480)
  durationMinutes!: number;

  @ApiProperty({ description: 'Price in smallest currency unit (e.g. tiyin)', example: 15000000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  price!: number;
}

export class UpdateServiceDto {
  @ApiPropertyOptional({ description: 'Service catalog item name' })
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @ApiPropertyOptional({ description: 'Detailed clinical service description' })
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  description?: string;

  @ApiPropertyOptional({ description: 'Duration in minutes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional({ description: 'Price in smallest currency unit' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  price?: number;
}

export class ServiceQueryDto {
  @ApiPropertyOptional({ enum: ServiceStatus, description: 'Filter by service active status' })
  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;
}
