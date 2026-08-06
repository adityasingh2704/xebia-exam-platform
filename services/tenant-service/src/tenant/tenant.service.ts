import {
  Injectable, NotFoundException, ConflictException, Logger, OnModuleInit,
} from '@nestjs/common';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto, UpdateTenantDto, UpdateBrandingDto, UpdateSettingsDto } from './dto';
import { successResponse, createPaginatedResponse, generateId, generateSlug } from '@xe-recruiters/shared-utils';

@Injectable()
export class TenantService implements OnModuleInit {
  private readonly logger = new Logger(TenantService.name);

  constructor(private prisma: PrismaService) { }

  onModuleInit() {
    this.logger.log('Initializing scheduled background tasks...');
    // Run the data retention purge task on startup and every 24 hours
    this.runDataRetentionPurge().catch(err => {
      this.logger.error(`Error running initial data retention purge: ${err.message}`);
    });
    setInterval(() => {
      this.runDataRetentionPurge().catch(err => {
        this.logger.error(`Error running scheduled data retention purge: ${err.message}`);
      });
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  async runDataRetentionPurge() {
    this.logger.log('Starting scheduled data retention policy purge...');
    try {
      const settingsList = await this.prisma.tenantSettings.findMany({});

      const userClientPath = path.resolve(process.cwd(), '../user-service/node_modules/@prisma/client/user');
      const { PrismaClient: UserPrismaClient } = require(userClientPath);
      const userPrisma = new UserPrismaClient({
        datasources: {
          db: {
            url: process.env.USER_DATABASE_URL || 'mongodb://localhost:27017/xe_user',
          },
        },
      });

      const examClientPath = path.resolve(process.cwd(), '../exam-service/node_modules/@prisma/client/exam');
      const { PrismaClient: ExamPrismaClient } = require(examClientPath);
      const examPrisma = new ExamPrismaClient({
        datasources: {
          db: {
            url: process.env.EXAM_DATABASE_URL || 'mongodb://localhost:27017/xe_exam',
          },
        },
      });

      for (const s of settingsList) {
        const tenantId = s.tenantId;

        // 1. Purge Audit Logs
        const auditLogThreshold = new Date();
        auditLogThreshold.setDate(auditLogThreshold.getDate() - (s.auditLogsRetentionDays ?? 730));
        const deletedLogs = await this.prisma.auditLog.deleteMany({
          where: {
            tenantId,
            createdAt: { lt: auditLogThreshold }
          }
        });
        if (deletedLogs.count > 0) {
          this.logger.log(`Purged ${deletedLogs.count} expired audit log(s) for tenant ${tenantId}`);
        }

        // 2. Purge Candidate Data & Results
        const candidateThreshold = new Date();
        candidateThreshold.setDate(candidateThreshold.getDate() - (s.candidateDataRetentionDays ?? 730));

        const expiredCandidates = await userPrisma.user.findMany({
          where: {
            tenantId,
            role: 'CANDIDATE',
            createdAt: { lt: candidateThreshold }
          },
          select: { id: true }
        });

        if (expiredCandidates.length > 0) {
          const expiredIds = expiredCandidates.map(c => c.id);

          // Delete exam assignments / results in exam service
          const deletedAssignments = await examPrisma.examAssignment.deleteMany({
            where: {
              tenantId,
              candidateId: { in: expiredIds }
            }
          });

          // Delete candidate users
          const deletedUsers = await userPrisma.user.deleteMany({
            where: {
              id: { in: expiredIds }
            }
          });

          this.logger.log(`Purged ${deletedUsers.count} expired candidates and ${deletedAssignments.count} assignments for tenant ${tenantId}`);
        }
      }

      await userPrisma.$disconnect();
      await examPrisma.$disconnect();

    } catch (err) {
      this.logger.error(`Error executing data retention purge: ${err.message}`);
    }
  }

  async getSystemHealth() {
    // 1. Calculate actual Memory Usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryPercent = Math.round((usedMem / totalMem) * 100);

    // 2. Calculate CPU usage
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    const cpuPercent = Math.round(100 - (totalIdle / (totalTick || 1)) * 100) || 12;

    // 3. Ping each microservice to check status and measure latency
    const services = [
      { name: 'API Gateway Router', url: 'http://localhost:3000/api/v1/health' },
      { name: 'Identity & Authentication Manager', url: 'http://localhost:3001/api/v1/health' },
      { name: 'Tenant Configurator Service', url: 'http://localhost:3002/api/v1/health' },
      { name: 'User & RBAC Manager', url: 'http://localhost:3003/api/v1/health' },
      { name: 'Evaluation / Exam Service', url: 'http://localhost:3004/api/v1/health' },
      { name: 'Question Bank Engine', url: 'http://localhost:3005/api/v1/health' }
    ];

    const serviceStatuses = [];
    for (const service of services) {
      const startTime = Date.now();
      let status = 'Offline';
      let latency = '0ms';
      let color = 'text-danger';

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000); // 1s timeout
        const res = await fetch(service.url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          status = 'Online';
          latency = `${Date.now() - startTime}ms`;
          color = 'text-emerald';
        }
      } catch {
        // Offline
      }

      serviceStatuses.push({
        name: service.name,
        status,
        delay: latency,
        color
      });
    }

    // 4. Check DB status
    let dbStatus = 'Optimal';
    try {
      await this.prisma.tenantBranding.findFirst({ select: { id: true } });
    } catch {
      dbStatus = 'Degraded';
    }

    return successResponse({
      cpuUsage: cpuPercent,
      memoryUsage: memoryPercent,
      dbStatus,
      services: serviceStatuses
    });
  }

  async create(dto: CreateTenantDto) {
    // Check slug uniqueness
    const existing = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Tenant with slug '${dto.slug}' already exists`);
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        id: generateId(),
        name: dto.name,
        slug: dto.slug || generateSlug(dto.name),
        plan: dto.plan || 'enterprise',
        branding: {
          create: {
            id: generateId(),
            primaryColor: '#6C1D5F',
            secondaryColor: '#FF6200',
            companyName: dto.name,
          },
        },
        settings: {
          create: {
            id: generateId(),
          },
        },
      },
      include: { branding: true, settings: true },
    });

    this.logger.log(`Tenant created: ${tenant.name} (${tenant.slug})`);

    // Provision default SecurityPolicy for new tenant
    await this.prisma.securityPolicy.create({
      data: {
        id: generateId(),
        tenantId: tenant.id,
        passwordMinLength: 10,
        requireSpecialChar: true,
        lockoutThreshold: 5,
        lockoutDuration: 15,
        firstLoginReset: true,
      },
    });

    // Create the administrator user in the MongoDB user database
    let adminUser = null;
    try {
      const userClientPath = path.resolve(process.cwd(), '../user-service/node_modules/@prisma/client/user');
      const { PrismaClient: UserPrismaClient } = require(userClientPath);
      const userPrisma = new UserPrismaClient({
        datasources: {
          db: {
            url: process.env.USER_DATABASE_URL || 'mongodb://localhost:27017/xe_user',
          },
        },
      });

      const bcrypt = require('bcryptjs');
      const tempPassword = 'TemporaryAdmin@123';
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      adminUser = await userPrisma.user.create({
        data: {
          id: generateId(),
          tenantId: tenant.id,
          email: dto.adminEmail,
          firstName: dto.adminFirstName || 'Admin',
          lastName: dto.adminLastName || 'User',
          role: 'TENANT_ADMIN',
          passwordHash,
          requiresPasswordReset: true, // Force password reset on first login!
          isActive: true,
        },
      });

      await userPrisma.$disconnect();

      // Create an audit log entry for onboarding
      await this.createAuditLog(
        tenant.id,
        'platform-admin',
        'Onboard Tenant Admin',
        `Tenant Admin account created for ${dto.adminEmail} with onboarding instructions`,
        '127.0.0.1'
      );

      // Simulation of sending onboarding email to Tenant Admin
      console.log(`\n==================================================`);
      console.log(`[EMAIL SIMULATION] Sent tenant onboarding email to: ${dto.adminEmail}`);
      console.log(`Tenant Slug: ${tenant.slug}`);
      console.log(`Onboarding Checklist:`);
      console.log(`  1. Access login link: http://localhost:3100/login`);
      console.log(`  2. Log in with temp credentials: ${dto.adminEmail} / ${tempPassword}`);
      console.log(`  3. Complete forced password reset upon first login`);
      console.log(`  4. Complete timezone & logo setup on configuration settings`);
      console.log(`==================================================\n`);

    } catch (err) {
      this.logger.error(`Failed to auto-provision initial Tenant Admin user: ${err.message}`);
    }

    return successResponse(tenant);
  }

  async findAll(page: number = 1, limit: number = 20, search?: string) {
    const where = search
      ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { slug: { contains: search, mode: 'insensitive' as const } },
        ],
      }
      : {};

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { branding: true, settings: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return successResponse(createPaginatedResponse(tenants, total, page, limit));
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { branding: true, settings: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant '${id}' not found`);
    }

    return successResponse(tenant);
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: { branding: true, settings: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with slug '${slug}' not found`);
    }

    return successResponse(tenant);
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.ensureExists(id);

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: dto,
      include: { branding: true, settings: true },
    });

    return successResponse(tenant);
  }

  async updateBranding(tenantId: string, dto: UpdateBrandingDto) {
    await this.ensureExists(tenantId);

    const branding = await this.prisma.tenantBranding.upsert({
      where: { tenantId },
      create: { id: generateId(), tenantId, ...dto },
      update: dto,
    });

    return successResponse(branding);
  }

  async updateSettings(tenantId: string, dto: UpdateSettingsDto) {
    await this.ensureExists(tenantId);

    const settings = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { id: generateId(), tenantId, ...dto },
      update: dto,
    });

    return successResponse(settings);
  }

  async softDelete(id: string) {
    await this.ensureExists(id);

    // Cascade clean relationships in tenant database
    await this.prisma.tenantBranding.deleteMany({ where: { tenantId: id } });
    await this.prisma.tenantSettings.deleteMany({ where: { tenantId: id } });
    await this.prisma.securityPolicy.deleteMany({ where: { tenantId: id } });
    await this.prisma.auditLog.deleteMany({ where: { tenantId: id } });

    await this.prisma.tenant.delete({
      where: { id },
    });

    this.logger.log(`Tenant ${id} permanently deleted`);
    return successResponse({ message: 'Tenant deleted successfully' });
  }

  // API Keys
  async getApiKeys(tenantId: string) {
    const keys = await this.prisma.apiKey.findMany({ where: { tenantId } });
    return successResponse(keys);
  }

  async createApiKey(tenantId: string, name: string) {
    const randomHex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const key = `xe_live_${randomHex}`;
    const newKey = await this.prisma.apiKey.create({
      data: {
        id: generateId(),
        tenantId,
        name,
        key,
        status: 'ACTIVE'
      }
    });
    return successResponse(newKey);
  }

  async deleteApiKey(id: string) {
    await this.prisma.apiKey.delete({ where: { id } });
    return successResponse({ message: 'API Key revoked' });
  }

  // Webhooks
  async getWebhookConfigs(tenantId: string) {
    const configs = await this.prisma.webhookConfig.findMany({ where: { tenantId } });
    return successResponse(configs);
  }

  async createWebhookConfig(tenantId: string, url: string) {
    const newConfig = await this.prisma.webhookConfig.create({
      data: {
        id: generateId(),
        tenantId,
        url,
        isActive: true
      }
    });
    return successResponse(newConfig);
  }

  async deleteWebhookConfig(id: string) {
    await this.prisma.webhookConfig.delete({ where: { id } });
    return successResponse({ message: 'Webhook deleted' });
  }

  // Security Policies
  async getSecurityPolicy(tenantId: string) {
    let policy = await this.prisma.securityPolicy.findUnique({ where: { tenantId } });
    if (!policy) {
      policy = await this.prisma.securityPolicy.create({
        data: {
          id: generateId(),
          tenantId,
          passwordMinLength: 8,
          requireSpecialChar: true,
          lockoutThreshold: 5,
          lockoutDuration: 15,
          firstLoginReset: true
        }
      });
    }
    return successResponse(policy);
  }

  async updateSecurityPolicy(tenantId: string, dto: any) {
    const policy = await this.prisma.securityPolicy.upsert({
      where: { tenantId },
      create: { id: generateId(), tenantId, ...dto },
      update: dto
    });
    return successResponse(policy);
  }

  // SMTP Settings
  async getSmtpConfig(tenantId: string) {
    let config = await this.prisma.smtpConfig.findUnique({ where: { tenantId } });
    if (!config) {
      config = await this.prisma.smtpConfig.create({
        data: {
          id: generateId(),
          tenantId,
          host: 'smtp.xe-recruiters.com',
          port: 587,
          user: 'notifications@xe-recruiters.com'
        }
      });
    }
    return successResponse(config);
  }

  async updateSmtpConfig(tenantId: string, dto: any) {
    const config = await this.prisma.smtpConfig.upsert({
      where: { tenantId },
      create: { id: generateId(), tenantId, ...dto },
      update: dto
    });
    return successResponse(config);
  }

  // Audit Logs
  async getAuditLogs(tenantId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
    return successResponse(logs);
  }

  async createAuditLog(tenantId: string, actor: string, action: string, details: string, ipAddress: string, status: string = 'SUCCESS') {
    const log = await this.prisma.auditLog.create({
      data: {
        id: generateId(),
        tenantId,
        actor,
        action,
        details,
        ipAddress,
        status
      }
    });
    return successResponse(log);
  }

  private async ensureExists(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant '${id}' not found`);
    }
    return tenant;
  }
}
