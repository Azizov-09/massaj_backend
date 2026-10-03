import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EmployeeStatus, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { EmployeesService } from './employees.service';

class EmployeeListQuery {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ description: 'Filter by position (partial match)' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ enum: EmployeeStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional({ description: 'Search by name, phone, or position' })
  @IsOptional()
  @IsString()
  search?: string;
}

@ApiTags('Employees')
@ApiBearerAuth('bearer')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Post()
  @ApiOperation({
    summary: 'Add Employee',
    description: 'Creates a new non-medical staff member record (Receptionist, Head Nurse, etc.).',
  })
  @ApiResponse({ status: 201, description: 'Employee created successfully.' })
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: RequestUser) {
    return this.employees.create(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List Employees',
    description: 'Returns paginated list of staff with optional position, status, and search filters.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of employees.' })
  findAll(@Query() query: EmployeeListQuery) {
    return this.employees.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Employee By ID' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Employee details.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Employee Record' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Employee updated.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.employees.update(id, dto, user.id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Archive Employee',
    description: 'Sets employee status to ARCHIVED (soft delete). Record is preserved.',
  })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Employee archived.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.employees.archive(id, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Delete Employee (SUPER_ADMIN only)',
    description: 'Permanently removes employee record. Only SUPER_ADMIN can perform this action.',
  })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 204, description: 'Employee permanently deleted.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.employees.remove(id, user.id);
  }
}
