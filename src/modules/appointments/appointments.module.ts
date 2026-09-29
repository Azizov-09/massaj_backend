import { Module } from '@nestjs/common';
import { ChildrenModule } from '../children/children.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
@Module({ imports: [ChildrenModule, NotificationsModule], controllers: [AppointmentsController], providers: [AppointmentsService], exports: [AppointmentsService] }) export class AppointmentsModule {}
