import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChildStatus, Gender } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateChildDto {
  @ApiProperty({ description: 'Child first name', example: 'Aziz' })
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiProperty({ description: 'Child last name', example: 'Karimov' })
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @ApiProperty({ description: 'Child birth date (YYYY-MM-DD)', example: '2020-05-15' })
  @IsDateString()
  birthDate!: string;

  @ApiProperty({ enum: Gender, description: 'Child biological gender', example: Gender.MALE })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiPropertyOptional({ description: 'Residential address', example: 'Tashkent, Chilanzar 7' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  address?: string;

  @ApiPropertyOptional({ description: 'General intake / administrative notes' })
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  notes?: string;
}

export class UpdateChildDto {
  @ApiPropertyOptional({ description: 'Child first name', example: 'Aziz' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Child last name', example: 'Karimov' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Child birth date (YYYY-MM-DD)', example: '2020-05-15' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: Gender, description: 'Child biological gender' })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Residential address' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  address?: string;

  @ApiPropertyOptional({ description: 'General intake / administrative notes' })
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  notes?: string;
}

export class LinkParentDto {
  @ApiProperty({ description: 'Relationship type (e.g., MOTHER, FATHER, GUARDIAN)', example: 'MOTHER' })
  @IsString()
  @Length(2, 80)
  relationship!: string;

  @ApiPropertyOptional({ description: 'Whether this parent is the primary contact', default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ChildQueryDto {
  @ApiPropertyOptional({ description: 'Search query for child first/last name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({ enum: ChildStatus, description: 'Filter by child status' })
  @IsOptional()
  @IsEnum(ChildStatus)
  status?: ChildStatus;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit = 20;
}
