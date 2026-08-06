import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { successResponse, createPaginatedResponse, generateId } from '@xe-recruiters/shared-utils';

@Injectable()
export class QuestionService {
  private readonly logger = new Logger(QuestionService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: any) {
    const tenantId = (dto.tenantId && dto.tenantId !== 'seed-tenant-acme' && dto.tenantId !== 'tenant_acme_001')
      ? dto.tenantId
      : '6a5fa9d2129f5cf7b7c7ab5a';
    const createdBy = dto.createdBy || 'usr_teacher_001';

    const question = await this.prisma.question.create({
      data: {
        id: generateId(),
        tenantId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        explanation: dto.explanation,
        difficulty: dto.difficulty || 'MEDIUM',
        points: dto.points || 1,
        timeLimit: dto.timeLimit,
        categoryId: dto.categoryId,
        createdBy,
        testCases: dto.testCases,
        programmingLanguage: dto.programmingLanguage,
        solutionCode: dto.solutionCode,
        templateCode: dto.templateCode,
        options: dto.options
          ? {
              create: dto.options.map((opt: any, idx: number) => ({
                id: generateId(),
                text: opt.text,
                isCorrect: opt.isCorrect ?? false,
                order: opt.order ?? idx + 1,
              })),
            }
          : undefined,
        tags: dto.tags
          ? {
              create: dto.tags.map((t: string) => ({
                id: generateId(),
                tag: t,
              })),
            }
          : undefined,
      },
      include: {
        options: { orderBy: { order: 'asc' } },
        tags: true,
      },
    });

    this.logger.log(`Question created: ${question.id} (${question.type})`);
    return successResponse(question);
  }

  async findAll(
    tenantId?: string,
    page: number = 1,
    limit: number = 20,
    filters: { type?: string; difficulty?: string; search?: string; categoryId?: string } = {},
  ) {
    const where: any = { isActive: true };
    if (tenantId && tenantId !== 'all' && tenantId !== 'undefined' && tenantId !== 'seed-tenant-acme') {
      where.tenantId = tenantId;
    }

    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.difficulty) {
      where.difficulty = filters.difficulty;
    }
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { body: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    let [questions, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          options: { orderBy: { order: 'asc' } },
          tags: true,
          category: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.question.count({ where }),
    ]);

    if (total === 0 && where.tenantId) {
      const fallbackWhere = { ...where };
      delete fallbackWhere.tenantId;
      [questions, total] = await Promise.all([
        this.prisma.question.findMany({
          where: fallbackWhere,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            options: { orderBy: { order: 'asc' } },
            tags: true,
            category: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.question.count({ where: fallbackWhere }),
      ]);
    }

    this.logger.log(`findAll query completed, returning ${questions.length} questions out of ${total}`);
    return successResponse(createPaginatedResponse(questions, total, page, limit));
  }

  async findById(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        options: { orderBy: { order: 'asc' } },
        tags: true,
        category: true,
      },
    });

    if (!question || !question.isActive) {
      throw new NotFoundException(`Question '${id}' not found`);
    }

    return successResponse(question);
  }

  async update(id: string, dto: any) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question || !question.isActive) {
      throw new NotFoundException(`Question '${id}' not found`);
    }

    // Handle options and tags separately if provided
    if (dto.options) {
      await this.prisma.questionOption.deleteMany({ where: { questionId: id } });
    }
    if (dto.tags) {
      await this.prisma.questionTag.deleteMany({ where: { questionId: id } });
    }

    const updated = await this.prisma.question.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.body && { body: dto.body }),
        ...(dto.explanation !== undefined && { explanation: dto.explanation }),
        ...(dto.difficulty && { difficulty: dto.difficulty }),
        ...(dto.points !== undefined && { points: dto.points }),
        ...(dto.timeLimit !== undefined && { timeLimit: dto.timeLimit }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.testCases !== undefined && { testCases: dto.testCases }),
        ...(dto.programmingLanguage !== undefined && { programmingLanguage: dto.programmingLanguage }),
        ...(dto.solutionCode !== undefined && { solutionCode: dto.solutionCode }),
        ...(dto.templateCode !== undefined && { templateCode: dto.templateCode }),
        ...(dto.options && {
          options: {
            create: dto.options.map((opt: any, idx: number) => ({
              id: generateId(),
              text: opt.text,
              isCorrect: opt.isCorrect ?? false,
              order: opt.order ?? idx + 1,
            })),
          },
        }),
        ...(dto.tags && {
          tags: {
            create: dto.tags.map((t: string) => ({
              id: generateId(),
              tag: t,
            })),
          },
        }),
      },
      include: {
        options: { orderBy: { order: 'asc' } },
        tags: true,
      },
    });

    return successResponse(updated);
  }

  async delete(id: string) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) {
      throw new NotFoundException(`Question '${id}' not found`);
    }

    await this.prisma.question.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Question soft-deleted: ${id}`);
    return successResponse({ message: 'Question soft deleted' });
  }

  async importQuestions(tenantId: string, file: any, categoryId?: string) {
    this.logger.log(`Importing questions for tenant ${tenantId}`);
    // Mock import process
    return successResponse({
      message: 'Questions imported successfully (Mock)',
      importedCount: 5,
    });
  }
}
