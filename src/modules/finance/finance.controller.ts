import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsDateString, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { FinanceQueryDto, RecordPaymentDto, RefundDto } from './dto/finance.dto';
import { FinanceService } from './finance.service';

class TransactionQueryDto {
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

@ApiTags('Finance')
@ApiBearerAuth()
@Controller()
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  // Payments
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('payments')
  @ApiOperation({ summary: 'Record Manual Payment', description: 'Records payment and credits child account balance.' })
  @ApiResponse({ status: 201, description: 'Payment recorded and ledger updated.' })
  payment(@Body() dto: RecordPaymentDto, @CurrentUser() user: RequestUser) {
    return this.finance.recordPayment(dto, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('payments')
  @ApiOperation({ summary: 'List Payments', description: 'Lists all payments with optional filtering.' })
  @ApiResponse({ status: 200, description: 'Paginated list of payments.' })
  payments(@Query() query: FinanceQueryDto) {
    return this.finance.payments(query.parentId, query.childId, query.page, query.limit, query.from, query.to);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('payments/:id')
  @ApiOperation({ summary: 'Get Payment By ID' })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({ status: 200, description: 'Payment details.' })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  paymentById(@Param('id') id: string) {
    return this.finance.paymentById(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('payments/:id/refund')
  @ApiOperation({ summary: 'Refund Payment', description: 'Issues full or partial refund creating compensating ledger transaction.' })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({ status: 201, description: 'Refund processed successfully.' })
  @ApiResponse({ status: 400, description: 'Refund amount exceeds remaining refundable amount.' })
  refund(@Param('id') id: string, @Body() dto: RefundDto, @CurrentUser() user: RequestUser) {
    return this.finance.refund(id, dto, user.id);
  }

  // Transactions
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('transactions')
  @ApiOperation({ summary: 'List Immutable Financial Ledger Transactions' })
  @ApiResponse({ status: 200, description: 'Paginated transactions list.' })
  transactions(@Query() query: TransactionQueryDto) {
    return this.finance.transactions(query.parentId, query.childId, query.page, query.limit, query.from, query.to);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get Single Ledger Transaction' })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @ApiResponse({ status: 200, description: 'Transaction details.' })
  transactionById(@Param('id') id: string) {
    return this.finance.transactionById(id);
  }

  // Debtors
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('debtors')
  @ApiOperation({ summary: 'List All Families with Outstanding Debt' })
  @ApiResponse({ status: 200, description: 'List of debtor accounts with balances.' })
  debtors() {
    return this.finance.allDebtors();
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('debtors/:parentId')
  @ApiOperation({ summary: 'Get Financial State For Specific Parent' })
  @ApiParam({ name: 'parentId', description: 'Parent UUID' })
  @ApiResponse({ status: 200, description: 'Account balance and debt summary.' })
  debtor(@Param('parentId') parentId: string) {
    return this.finance.stateForParent(parentId);
  }

  // Child balance
  @Get('children/:childId/balance')
  @ApiOperation({ summary: 'Get Balance/Debt For Child' })
  @ApiParam({ name: 'childId', description: 'Child UUID' })
  @ApiResponse({ status: 200, description: 'Child balance state.' })
  childBalance(@Param('childId') childId: string, @CurrentUser() user: RequestUser) {
    return this.finance.stateForChild(childId, user);
  }

  @Get('parents/:parentId/balance')
  @ApiOperation({ summary: 'Get Balance/Debt For Parent' })
  @ApiParam({ name: 'parentId', description: 'Parent UUID' })
  @ApiResponse({ status: 200, description: 'Parent balance state.' })
  parentBalance(@Param('parentId') parentId: string, @CurrentUser() user: RequestUser) {
    return this.finance.parentBalance(parentId, user);
  }

  @Get('parents/:parentId/financial-summary')
  @ApiOperation({ summary: 'Full Financial Summary for Parent' })
  @ApiParam({ name: 'parentId', description: 'Parent UUID' })
  @ApiResponse({ status: 200, description: 'Full breakdown of invoices, payments, and balance.' })
  financialSummary(@Param('parentId') parentId: string, @CurrentUser() user: RequestUser) {
    return this.finance.financialSummary(parentId, user);
  }
}
