import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { CreateDocumentDto, RecordConsentDto, UpdateConsentDto, UpdateSettingsDto } from './dto/platform.dto';
import { PlatformService } from './platform.service';

@ApiTags('Platform')
@ApiBearerAuth()
@Controller()
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('children/:childId/consents')
  @ApiOperation({ summary: 'List Legal / Medical Consents For Child' })
  @ApiParam({ name: 'childId', description: 'Child UUID' })
  @ApiResponse({ status: 200, description: 'List of recorded consents.' })
  consents(@Param('childId') id: string, @CurrentUser() user: RequestUser) {
    return this.platform.consents(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PARENT)
  @Post('children/:childId/consents')
  @ApiOperation({ summary: 'Record Consent Agreement' })
  @ApiParam({ name: 'childId', description: 'Child UUID' })
  @ApiResponse({ status: 201, description: 'Consent recorded.' })
  consent(@Param('childId') id: string, @Body() dto: RecordConsentDto, @CurrentUser() user: RequestUser) {
    return this.platform.recordConsent(id, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PARENT)
  @Patch('consents/:id')
  @ApiOperation({ summary: 'Update / Revoke Consent Status' })
  @ApiParam({ name: 'id', description: 'Consent record UUID' })
  @ApiResponse({ status: 200, description: 'Consent status updated.' })
  updateConsent(@Param('id') id: string, @Body() dto: UpdateConsentDto, @CurrentUser() user: RequestUser) {
    return this.platform.updateConsent(id, dto, user);
  }

  @Get('children/:childId/documents')
  @ApiOperation({ summary: 'List Documents Uploaded For Child' })
  @ApiParam({ name: 'childId', description: 'Child UUID' })
  @ApiResponse({ status: 200, description: 'List of registered documents.' })
  documents(@Param('childId') id: string, @CurrentUser() user: RequestUser) {
    return this.platform.documents(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PARENT)
  @Post('children/:childId/documents')
  @ApiOperation({ summary: 'Register Child Medical Document Metadata' })
  @ApiParam({ name: 'childId', description: 'Child UUID' })
  @ApiResponse({ status: 201, description: 'Document registered.' })
  addDocument(@Param('childId') id: string, @Body() dto: CreateDocumentDto, @CurrentUser() user: RequestUser) {
    return this.platform.registerDocument(id, dto, user);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Get Document Details / Download Key' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiResponse({ status: 200, description: 'Document details.' })
  document(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.platform.document(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('settings')
  @ApiOperation({ summary: 'Get Clinic System Settings' })
  @ApiResponse({ status: 200, description: 'System configuration settings.' })
  settings() {
    return this.platform.getSettings();
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch('settings')
  @ApiOperation({ summary: 'Update Clinic System Settings' })
  @ApiResponse({ status: 200, description: 'System configuration updated.' })
  updateSettings(@Body() dto: UpdateSettingsDto, @CurrentUser() user: RequestUser) {
    return this.platform.updateSettings(dto, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('activity-logs')
  @ApiOperation({ summary: 'Query Audit / Activity Logs' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Paginated audit trail.' })
  logs(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.platform.activityLogs(Number(page), Math.min(100, Number(limit)));
  }
}
