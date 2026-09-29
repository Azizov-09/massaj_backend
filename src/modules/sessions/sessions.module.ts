import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
@Module({ imports: [FinanceModule], controllers: [SessionsController], providers: [SessionsService] }) export class SessionsModule {}
