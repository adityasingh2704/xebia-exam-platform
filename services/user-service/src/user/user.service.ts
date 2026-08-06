import {
  Injectable, NotFoundException, ConflictException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  successResponse, createPaginatedResponse, generateId,
  hashPassword,
} from '@xe-recruiters/shared-utils';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: {
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    password?: string;
  }) {
    // Check duplicate
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, tenantId: dto.tenantId },
    });
    if (existing) {
      throw new ConflictException(`User with email '${dto.email}' already exists in this tenant`);
    }

    const tempPassword = dto.password || `Xe@${Math.random().toString(36).slice(2, 10)}`;
    const passwordHash = await hashPassword(tempPassword);

    const user = await this.prisma.user.create({
      data: {
        id: generateId(),
        tenantId: dto.tenantId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role as any,
        requiresPasswordReset: true,
      },
    });

    this.logger.log(`User created: ${user.email} (${user.role}) in tenant ${user.tenantId}`);

    return successResponse({
      ...user,
      passwordHash: undefined, // Never expose hash
      temporaryPassword: tempPassword, // Only in response to creation
    });
  }

  async findAll(
    tenantId?: string,
    page: number = 1,
    limit: number = 20,
    role?: string,
    search?: string,
  ) {
    const where: any = {};
    if (tenantId && tenantId !== 'all' && tenantId !== 'undefined') {
      where.tenantId = tenantId;
    }
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return successResponse(createPaginatedResponse(users, total, page, limit));
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        phone: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundException(`User '${id}' not found`);
    return successResponse(user);
  }

  async findByEmail(email: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, tenantId },
    });
    if (!user) throw new NotFoundException(`User with email '${email}' not found`);
    return user;
  }

  async update(id: string, dto: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User '${id}' not found`);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.role && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.phone && { phone: dto.phone }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return successResponse(updated);
  }

  async deactivate(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User '${id}' not found`);

    // Clean relations
    await this.prisma.candidateGroupMember.deleteMany({
      where: { userId: id }
    });

    await this.prisma.user.delete({
      where: { id },
    });

    this.logger.log(`User ${id} permanently deleted`);
    return successResponse({ message: 'User deleted successfully' });
  }

  async invite(dto: {
    tenantId?: string;
    users: Array<{ email: string; firstName: string; lastName: string; role: string }>;
  }) {
    const tenantId = dto.tenantId;
    const results = [];

    for (const user of dto.users) {
      const token = generateId();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

      const invitation = await this.prisma.invitation.create({
        data: {
          id: generateId(),
          tenantId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as any,
          token,
          expiresAt,
          invitedBy: 'system',
        },
      });

      results.push(invitation);
      this.logger.log(`Invitation sent to ${user.email} as ${user.role}`);
    }

    return successResponse({
      message: `${results.length} invitation(s) sent`,
      invitations: results,
    });
  }

  async bulkImport(dto: {
    tenantId: string;
    users: Array<{ email: string; firstName: string; lastName: string; role: string }>;
  }) {
    const tenantId = dto.tenantId;
    const users = dto.users || [];
    const results = [];

    const defaultPasswordHash = await hashPassword('TemporaryPassword@123');

    for (const u of users) {
      const existing = await this.prisma.user.findFirst({
        where: { email: u.email, tenantId }
      });
      if (existing) continue;

      const newUser = await this.prisma.user.create({
        data: {
          id: generateId(),
          tenantId,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: (u.role || 'CANDIDATE') as any,
          passwordHash: defaultPasswordHash,
          requiresPasswordReset: true,
          isActive: true
        }
      });
      results.push(newUser);
    }

    this.logger.log(`Bulk imported ${results.length} users in tenant ${tenantId}`);
    return successResponse({
      message: `Bulk imported ${results.length} users successfully`,
      importedCount: results.length
    });
  }

  async createDsarRequest(userId: string, tenantId: string, type: 'EXPORT' | 'DELETION') {
    const dsar = await this.prisma.dsarRequest.create({
      data: {
        id: generateId(),
        userId,
        tenantId,
        type,
        status: 'PENDING'
      }
    });

    this.logger.log(`DSAR ${type} request created for user ${userId} in tenant ${tenantId}`);
    return successResponse(dsar);
  }

  async getDsarRequests(userId: string, tenantId: string, role: string) {
    const where = role === 'TENANT_ADMIN' || role === 'PLATFORM_ADMIN'
      ? { tenantId }
      : { userId, tenantId };

    const list = await this.prisma.dsarRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return successResponse(list);
  }

  async downloadDsarExport(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const groupMemberships = await this.prisma.candidateGroupMember.findMany({
      where: { userId },
      include: { group: true }
    });

    let examData = [];
    try {
      const path = require('path');
      const examClientPath = path.resolve(process.cwd(), '../exam-service/node_modules/@prisma/client/exam');
      const { PrismaClient: ExamPrismaClient } = require(examClientPath);
      const examPrisma = new ExamPrismaClient({
        datasources: {
          db: {
            url: process.env.EXAM_DATABASE_URL || 'mongodb://localhost:27017/xe_exam',
          },
        },
      });
      examData = await examPrisma.examAssignment.findMany({
        where: { candidateId: userId },
        include: { exam: true }
      });
      await examPrisma.$disconnect();
    } catch (err) {
      this.logger.error(`Failed to load exam data for DSAR: ${err.message}`);
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      complianceStandard: 'GDPR / CCPA Data Subject Access Request',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      groups: groupMemberships.map(g => ({
        id: g.group.id,
        name: g.group.name,
      })),
      examinations: examData.map(e => ({
        assignmentId: e.id,
        examId: e.examId,
        title: e.exam?.title,
        duration: e.exam?.duration,
        status: e.status,
        score: e.score,
        totalMarks: e.totalMarks,
        startedAt: e.startedAt,
        submittedAt: e.submittedAt,
        attemptsUsed: e.attemptsUsed,
        timeMultiplier: e.timeMultiplier,
        extraTimeMinutes: e.extraTimeMinutes
      }))
    };

    await this.prisma.dsarRequest.updateMany({
      where: { userId, type: 'EXPORT', status: 'PENDING' },
      data: { status: 'COMPLETED' }
    });

    return successResponse(payload);
  }
}
