import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsDecimal,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({ description: 'Full name of the employee' })
  @IsString()
  @Length(2, 160)
  fullName!: string;

  @ApiProperty({ description: 'Job position / title (e.g. Receptionist, Head Nurse)' })
  @IsString()
  @Length(2, 100)
  position!: string;

  @ApiProperty({ description: 'Contact phone number' })
  @IsString()
  @Length(9, 32)
  phone!: string;

  @ApiPropertyOptional({ description: 'Corporate email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Date of joining (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  joinedAt?: string;

  @ApiPropertyOptional({ description: 'Monthly salary in local currency' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  salary?: number;

  @ApiPropertyOptional({ description: 'Internal notes about the employee' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ description: 'Full name of the employee' })
  @IsOptional()
  @IsString()
  @Length(2, 160)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Job position / title' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  position?: string;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  @Length(9, 32)
  phone?: string;

  @ApiPropertyOptional({ description: 'Corporate email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: EmployeeStatus, description: 'Employee status' })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional({ description: 'Monthly salary' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  salary?: number;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}
