import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { CancelSessionDto, CompleteSessionDto, SessionQueryDto } from './dto/sessions.dto';
import { SessionsService } from './sessions.service';
@ApiTags('sessions') @ApiBearerAuth() @Controller('sessions')
export class SessionsController { constructor(private readonly sessions: SessionsService) {} @Get() list(@Query() query: SessionQueryDto, @CurrentUser() user: RequestUser) { return this.sessions.list(query, user); } @Get(':id') get(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.sessions.get(id, user); } @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST) @Post(':id/complete') complete(@Param('id') id: string, @Body() dto: CompleteSessionDto, @CurrentUser() user: RequestUser) { return this.sessions.complete(id, dto, user); } @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST) @Post(':id/cancel') cancel(@Param('id') id: string, @Body() dto: CancelSessionDto, @CurrentUser() user: RequestUser) { return this.sessions.cancel(id, dto, user); } }
