import { Module } from '@nestjs/common';
import { ChildrenModule } from '../children/children.module';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
@Module({ imports: [ChildrenModule], controllers: [PlatformController], providers: [PlatformService] }) export class PlatformModule {}
