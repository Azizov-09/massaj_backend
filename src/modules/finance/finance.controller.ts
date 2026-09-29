import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { FinanceQueryDto, RecordPaymentDto, RefundDto } from './dto/finance.dto';
import { FinanceService } from './finance.service';

class TransactionQueryDto {
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsUUID() childId?: string;
  @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 50;
}

@ApiTags('finance')
@ApiBearerAuth()
@Controller()
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  // Payments
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('payments')
  @ApiOperation({ summary: 'Record a manual payment' })
  payment(@Body() dto: RecordPaymentDto, @CurrentUser() user: RequestUser) {
    return this.finance.recordPayment(dto, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('payments')
  @ApiOperation({ summary: 'List payments with optional parent/child filter' })
  payments(@Query() query: FinanceQueryDto) {
    return this.finance.payments(query.parentId, query.childId, query.page, query.limit);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('payments/:id')
  @ApiOperation({ summary: 'Get single payment' })
  paymentById(@Param('id') id: string) {
    return this.finance.paymentById(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('payments/:id/refund')
  @ApiOperation({ summary: 'Refund a payment (creates compensating transaction)' })
  refund(@Param('id') id: string, @Body() dto: RefundDto, @CurrentUser() user: RequestUser) {
    return this.finance.refund(id, dto, user.id);
  }

  // Transactions
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('transactions')
  @ApiOperation({ summary: 'List immutable financial transactions' })
  transactions(@Query() query: TransactionQueryDto) {
    return this.finance.transactions(query.parentId, query.childId, query.page, query.limit);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get single transaction' })
  transactionById(@Param('id') id: string) {
    return this.finance.transactionById(id);
  }

  // Debtors
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('debtors')
  @ApiOperation({ summary: 'List all families with outstanding debt' })
  debtors() {
    return this.finance.allDebtors();
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('debtors/:parentId')
  @ApiOperation({ summary: 'Get financial state for a specific parent' })
  debtor(@Param('parentId') parentId: string) {
    return this.finance.stateForParent(parentId);
  }

  // Child balance
  @Get('children/:childId/balance')
  @ApiOperation({ summary: 'Get balance/debt state for a child (all related families)' })
  childBalance(@Param('childId') childId: string, @CurrentUser() user: RequestUser) {
    return this.finance.stateForChild(childId, user);
  }

  @Get('parents/:parentId/balance')
  @ApiOperation({ summary: 'Get balance/debt for a specific parent (admin or self)' })
  parentBalance(@Param('parentId') parentId: string, @CurrentUser() user: RequestUser) {
    return this.finance.parentBalance(parentId, user);
  }

  @Get('parents/:parentId/financial-summary')
  @ApiOperation({ summary: 'Full financial summary for a parent' })
  financialSummary(@Param('parentId') parentId: string, @CurrentUser() user: RequestUser) {
    return this.finance.financialSummary(parentId, user);
  }
}
