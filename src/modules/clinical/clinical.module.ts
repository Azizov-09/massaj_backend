import { Module } from '@nestjs/common';
import { ChildrenModule } from '../children/children.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClinicalController } from './clinical.controller';
import { ClinicalService } from './clinical.service';
@Module({ imports: [ChildrenModule, NotificationsModule], controllers: [ClinicalController], providers: [ClinicalService] }) export class ClinicalModule {}
