import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get public settings' })
  @ApiResponse({ status: 200, description: 'Returns publicly visible settings.' })
  getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('all')
  @ApiOperation({ summary: 'Get all settings (JWT protected)' })
  @ApiResponse({ status: 200, description: 'Returns all settings including private ones.' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT token.' })
  getAllSettings() {
    return this.settingsService.getAll();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put()
  @ApiOperation({ summary: 'Update settings in batch (JWT protected)' })
  @ApiBody({
    description: 'Key-value pairs of settings to update',
    schema: {
      type: 'object',
      additionalProperties: { type: 'string' },
      example: { siteName: 'My Site', theme: 'dark' },
    },
  })
  @ApiResponse({ status: 200, description: 'Settings updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT token.' })
  updateSettings(@Body() body: Record<string, any>) {
    const settings = body.settings && typeof body.settings === 'object' ? body.settings : body;
    return this.settingsService.batchUpsert(settings);
  }
}
