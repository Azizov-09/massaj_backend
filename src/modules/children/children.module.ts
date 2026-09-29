import { Module } from '@nestjs/common';
import { AccessService } from '../../common/services/access.service';
import { ChildrenController } from './children.controller';
import { ChildrenService } from './children.service';
@Module({ controllers: [ChildrenController], providers: [ChildrenService, AccessService], exports: [ChildrenService, AccessService] }) export class ChildrenModule {}
