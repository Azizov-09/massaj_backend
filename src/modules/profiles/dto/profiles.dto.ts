import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateUserProfileDto {
  @ApiProperty({ description: 'User full name', example: 'Malika Karimova' })
  @IsString()
  @Length(2, 160)
  fullName!: string;

  @ApiProperty({ description: 'International phone number', example: '+998901234567' })
  @IsString()
  @Length(7, 32)
  phone!: string;

  @ApiProperty({
    description: 'Initial password (min 12 chars, must contain uppercase, lowercase, and number)',
    example: 'SecurePass123!',
    format: 'password',
  })
  @IsString()
  @Length(12, 128)
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/\d/, { message: 'Password must contain at least one digit' })
  password!: string;
}

export class CreateParentDto extends CreateUserProfileDto {
  @ApiPropertyOptional({ description: 'Residential address', example: 'Tashkent, Mirzo Ulugbek 12' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  address?: string;
}

export class UpdateParentDto {
  @ApiPropertyOptional({ description: 'Updated full name', example: 'Malika Karimova' })
  @IsOptional()
  @IsString()
  @Length(2, 160)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Residential address' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  address?: string;
}

export class CreateSpecialistDto extends CreateUserProfileDto {
  @ApiProperty({ description: 'Clinical specialization', example: 'Pediatric Massage Therapist & Physical Rehab' })
  @IsString()
  @Length(2, 250)
  specialization!: string;

  @ApiProperty({ description: 'Years of clinical rehabilitation experience', example: 7 })
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears!: number;

  @ApiPropertyOptional({ description: 'Professional biography and credentials' })
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  bio?: string;
}

export class UpdateSpecialistDto {
  @ApiPropertyOptional({ description: 'Clinical specialization' })
  @IsOptional()
  @IsString()
  @Length(2, 250)
  specialization?: string;

  @ApiPropertyOptional({ description: 'Years of experience' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears?: number;

  @ApiPropertyOptional({ description: 'Professional biography' })
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  bio?: string;
}
