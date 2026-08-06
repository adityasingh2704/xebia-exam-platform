import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';

@ApiTags('users')
@Controller('users')
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() dto: any) {
    return this.userService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all users for a tenant' })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('role') role?: string,
    @Query('search') search?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.userService.findAll(tenantId, parseInt(page) || 1, parseInt(limit) || 20, role, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate user' })
  async deactivate(@Param('id') id: string) {
    return this.userService.deactivate(id);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite users via email' })
  async invite(@Body() dto: any) {
    return this.userService.invite(dto);
  }

  @Post('import')
  @ApiOperation({ summary: 'Bulk import users from CSV' })
  async bulkImport(@Body() dto: any) {
    return this.userService.bulkImport(dto);
  }

  @Post('dsar')
  @ApiOperation({ summary: 'Submit a new DSAR compliance request' })
  async createDsarRequest(@Body() dto: { userId: string; tenantId: string; type: 'EXPORT' | 'DELETION' }) {
    return this.userService.createDsarRequest(dto.userId, dto.tenantId, dto.type);
  }

  @Get('dsar/list')
  @ApiOperation({ summary: 'List DSAR compliance requests' })
  async getDsarRequests(
    @Query('userId') userId: string,
    @Query('tenantId') tenantId: string,
    @Query('role') role: string,
  ) {
    return this.userService.getDsarRequests(userId, tenantId, role);
  }

  @Get(':id/dsar-download')
  @ApiOperation({ summary: 'Download generated DSAR compliance export bundle' })
  async downloadDsarExport(@Param('id') id: string) {
    return this.userService.downloadDsarExport(id);
  }
}
