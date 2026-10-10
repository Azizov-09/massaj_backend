import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({ description: 'Full name of the administrator' })
  @IsString()
  @Length(2, 160)
  fullName!: string;

  @ApiProperty({ description: 'Uzbek phone number (+998XXXXXXXXX)' })
  @IsString()
  @Length(9, 32)
  phone!: string;

  @ApiPropertyOptional({ description: 'Email address (optional)' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ enum: [Role.SUPER_ADMIN, Role.ADMIN], description: 'Admin role' })
  @IsEnum(Role)
  @IsIn([Role.SUPER_ADMIN, Role.ADMIN])
  role!: Role;

  @ApiProperty({
    description: 'Initial password (min 12 chars, uppercase, lowercase, digit)',
    format: 'password',
  })
  @IsString()
  @Length(12, 128)
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/\d/, { message: 'Password must contain at least one digit' })
  password!: string;
}

export class UpdateAdminDto {
  @ApiPropertyOptional({ description: 'Full name of the administrator' })
  @IsOptional()
  @IsString()
  @Length(2, 160)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Uzbek phone number (+998XXXXXXXXX)' })
  @IsOptional()
  @IsString()
  @Length(9, 32)
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: [Role.SUPER_ADMIN, Role.ADMIN], description: 'Admin role' })
  @IsOptional()
  @IsEnum(Role)
  @IsIn([Role.SUPER_ADMIN, Role.ADMIN])
  role?: Role;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'], description: 'User status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'New password (min 12 chars, uppercase, lowercase, digit)',
    format: 'password',
  })
  @IsOptional()
  @IsString()
  @Length(12, 128)
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/\d/, { message: 'Password must contain at least one digit' })
  password?: string;
}
