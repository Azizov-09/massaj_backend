import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CompleteSessionDto {
  @ApiPropertyOptional({ description: 'General session execution notes' })
  @IsOptional()
  @IsString()
  @Max(2000)
  note?: string;

  @ApiPropertyOptional({ description: 'Specialist clinical observation during session' })
  @IsOptional()
  @IsString()
  @Max(5000)
  observation?: string;

  @ApiPropertyOptional({ description: 'Recommendations for parents / home exercises' })
  @IsOptional()
  @IsString()
  @Max(5000)
  recommendation?: string;
}

export class CancelSessionDto {
  @ApiPropertyOptional({ description: 'Reason for session cancellation' })
  @IsOptional()
  @IsString()
  @Max(1000)
  note?: string;
}

export class SessionQueryDto {
  @ApiPropertyOptional({ description: 'Filter by child UUID' })
  @IsOptional()
  @IsUUID()
  childId?: string;

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
