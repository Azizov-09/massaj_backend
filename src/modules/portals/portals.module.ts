import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { PortalsController } from './portals.controller';
import { PortalsService } from './portals.service';
@Module({ imports: [FinanceModule], controllers: [PortalsController], providers: [PortalsService] }) export class PortalsModule {}
