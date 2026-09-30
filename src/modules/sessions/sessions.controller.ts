import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { CancelSessionDto, CompleteSessionDto, SessionQueryDto } from './dto/sessions.dto';
import { SessionsService } from './sessions.service';

@ApiTags('Sessions')
@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  @ApiOperation({ summary: 'List Clinical Sessions', description: 'Lists rehabilitation sessions subject to role access permissions.' })
  @ApiResponse({ status: 200, description: 'Paginated sessions.' })
  list(@Query() query: SessionQueryDto, @CurrentUser() user: RequestUser) {
    return this.sessions.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Clinical Session By ID' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 200, description: 'Session details.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.sessions.get(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete Clinical Session', description: 'Records observations, recommendations, and marks session as COMPLETED.' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 200, description: 'Session marked as completed.' })
  complete(@Param('id') id: string, @Body() dto: CompleteSessionDto, @CurrentUser() user: RequestUser) {
    return this.sessions.complete(id, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel Clinical Session' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 200, description: 'Session marked as cancelled.' })
  cancel(@Param('id') id: string, @Body() dto: CancelSessionDto, @CurrentUser() user: RequestUser) {
    return this.sessions.cancel(id, dto, user);
  }
}
