import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param,
  HttpCode, HttpStatus, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto, UpdateTenantDto, UpdateBrandingDto, UpdateSettingsDto } from './dto';

@ApiTags('tenants')
@Controller('tenants')
@ApiBearerAuth()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tenant (Platform Admin only)' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all tenants (Platform Admin only)' })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ) {
    return this.tenantService.findAll(parseInt(page) || 1, parseInt(limit) || 20, search);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current tenant details' })
  async getCurrent() {
    // Return first available tenant
    return this.tenantService.findAll(1, 1);
  }

  @Get('system/health')
  @ApiOperation({ summary: 'Get system real-time stats and service health' })
  async getSystemHealth() {
    return this.tenantService.getSystemHealth();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  async findById(@Param('id') id: string) {
    return this.tenantService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update tenant details' })
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantService.update(id, dto);
  }

  @Put(':id/branding')
  @ApiOperation({ summary: 'Update tenant branding' })
  async updateBranding(@Param('id') id: string, @Body() dto: UpdateBrandingDto) {
    return this.tenantService.updateBranding(id, dto);
  }

  @Put(':id/settings')
  @ApiOperation({ summary: 'Update tenant settings' })
  async updateSettings(@Param('id') id: string, @Body() dto: UpdateSettingsDto) {
    return this.tenantService.updateSettings(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a tenant (Platform Admin only)' })
  async delete(@Param('id') id: string) {
    return this.tenantService.softDelete(id);
  }

  // API Keys
  @Get(':tenantId/api-keys')
  @ApiOperation({ summary: 'Get tenant API Keys' })
  async getApiKeys(@Param('tenantId') tenantId: string) {
    return this.tenantService.getApiKeys(tenantId);
  }

  @Post(':tenantId/api-keys')
  @ApiOperation({ summary: 'Create API Key' })
  async createApiKey(@Param('tenantId') tenantId: string, @Body() dto: { name: string }) {
    return this.tenantService.createApiKey(tenantId, dto.name);
  }

  @Delete('api-keys/:id')
  @ApiOperation({ summary: 'Delete API Key' })
  async deleteApiKey(@Param('id') id: string) {
    return this.tenantService.deleteApiKey(id);
  }

  // Webhooks
  @Get(':tenantId/webhooks')
  @ApiOperation({ summary: 'Get tenant Webhooks' })
  async getWebhookConfigs(@Param('tenantId') tenantId: string) {
    return this.tenantService.getWebhookConfigs(tenantId);
  }

  @Post(':tenantId/webhooks')
  @ApiOperation({ summary: 'Create Webhook' })
  async createWebhookConfig(@Param('tenantId') tenantId: string, @Body() dto: { url: string }) {
    return this.tenantService.createWebhookConfig(tenantId, dto.url);
  }

  @Delete('webhooks/:id')
  @ApiOperation({ summary: 'Delete Webhook' })
  async deleteWebhookConfig(@Param('id') id: string) {
    return this.tenantService.deleteWebhookConfig(id);
  }

  // Security Policy
  @Get(':tenantId/security-policy')
  @ApiOperation({ summary: 'Get tenant Security Policy' })
  async getSecurityPolicy(@Param('tenantId') tenantId: string) {
    return this.tenantService.getSecurityPolicy(tenantId);
  }

  @Put(':tenantId/security-policy')
  @ApiOperation({ summary: 'Update tenant Security Policy' })
  async updateSecurityPolicy(@Param('tenantId') tenantId: string, @Body() dto: any) {
    return this.tenantService.updateSecurityPolicy(tenantId, dto);
  }

  // SMTP Configuration
  @Get(':tenantId/smtp')
  @ApiOperation({ summary: 'Get SMTP config' })
  async getSmtpConfig(@Param('tenantId') tenantId: string) {
    return this.tenantService.getSmtpConfig(tenantId);
  }

  @Put(':tenantId/smtp')
  @ApiOperation({ summary: 'Update SMTP config' })
  async updateSmtpConfig(@Param('tenantId') tenantId: string, @Body() dto: any) {
    return this.tenantService.updateSmtpConfig(tenantId, dto);
  }

  // Audit Logs
  @Get(':tenantId/audit-logs')
  @ApiOperation({ summary: 'Get Audit Logs' })
  async getAuditLogs(@Param('tenantId') tenantId: string) {
    return this.tenantService.getAuditLogs(tenantId);
  }

  @Post(':tenantId/audit-logs')
  @ApiOperation({ summary: 'Create Audit Log' })
  async createAuditLog(
    @Param('tenantId') tenantId: string,
    @Body() dto: { actor: string; action: string; details: string; ipAddress: string; status?: string }
  ) {
    return this.tenantService.createAuditLog(tenantId, dto.actor, dto.action, dto.details, dto.ipAddress, dto.status);
  }
}
