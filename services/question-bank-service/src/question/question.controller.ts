import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  HttpCode, HttpStatus, UseInterceptors, UploadedFile
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QuestionService } from './question.service';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('questions')
@Controller(['questions', 'api/v1/questions'])
@ApiBearerAuth()
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new question (MCQ, MRQ, True/False, Programming, Essay)' })
  async create(@Body() dto: any) {
    return this.questionService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List and filter questions' })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('type') type?: string,
    @Query('difficulty') difficulty?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.questionService.findAll(tenantId, parseInt(page) || 1, parseInt(limit) || 20, {
      type,
      difficulty,
      search,
      categoryId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get question details by ID' })
  async findById(@Param('id') id: string) {
    return this.questionService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a question' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.questionService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete / deactivate a question' })
  async delete(@Param('id') id: string) {
    return this.questionService.delete(id);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk import questions via JSON/CSV' })
  async importQuestions(
    @UploadedFile() file: any,
    @Body('tenantId') tenantId?: string,
    @Body('categoryId') categoryId?: string,
  ) {
    return this.questionService.importQuestions(tenantId || 'tenant_acme_001', file, categoryId);
  }
}
