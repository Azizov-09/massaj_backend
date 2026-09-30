import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'International E.164 phone number',
    example: '+998901234567',
  })
  @IsString()
  @Length(7, 32)
  phone!: string;

  @ApiProperty({
    description: 'Account password',
    example: 'Password123!',
    format: 'password',
  })
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class RefreshDto {
  @ApiProperty({
    description: 'Cryptographic refresh token string',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @Length(20, 4096)
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password for verification',
    example: 'OldPassword123!',
    format: 'password',
  })
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({
    description: 'New password (min 12 chars, must contain uppercase, lowercase, and digit)',
    example: 'NewSecurePassword123!',
    format: 'password',
  })
  @IsString()
  @Length(12, 128)
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/\d/, { message: 'Password must contain at least one digit' })
  newPassword!: string;
}
