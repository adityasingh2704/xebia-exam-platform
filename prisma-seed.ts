import { PrismaClient as TenantPrisma } from './services/tenant-service/node_modules/@prisma/client/tenant/index.js';
import { PrismaClient as UserPrisma } from './services/user-service/node_modules/@prisma/client/user/index.js';
import * as bcrypt from 'bcryptjs';

async function main() {
  const tenantClient = new TenantPrisma();
  const userClient = new UserPrisma();

  try {
    const tenantId = '6a5a9a57d6c9c2daf29ce83f';
    
    // User IDs
    const platformAdminId = '6a5a9a580d2754e0b63465b8';
    const tenantAdminId = '6a5a9a580d2754e0b63465b9';
    const teacherId = '6a5a9a580d2754e0b63465ba';
    const studentId = '6a5a9a580d2754e0b63465bb';
    
    // 1. Tenant
    await tenantClient.tenant.upsert({
      where: { id: tenantId },
      update: {},
      create: {
        id: tenantId,
        name: 'Acme University',
        slug: 'acme-university',
        status: 'ACTIVE',
        plan: 'enterprise',
        maxSeats: 500,
        usedSeats: 0,
        branding: {
          create: {
            primaryColor: '#2563eb',
            secondaryColor: '#FF6200'
          }
        }
      }
    });
    console.log('✅ Seeded Tenant');

    // 2. Users
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    
    // Platform Admin
    await userClient.user.upsert({
      where: { id: platformAdminId },
      update: { passwordHash: hashedPassword },
      create: {
        id: platformAdminId,
        tenantId: tenantId,
        email: 'admin@acme.edu',
        passwordHash: hashedPassword,
        firstName: 'Platform',
        lastName: 'Admin',
        role: 'PLATFORM_ADMIN',
        isActive: true,
        requiresPasswordReset: false
      }
    });

    // Tenant Admin
    await userClient.user.upsert({
      where: { id: tenantAdminId },
      update: { passwordHash: hashedPassword },
      create: {
        id: tenantAdminId,
        tenantId: tenantId,
        email: 'tenantadmin@acme.edu',
        passwordHash: hashedPassword,
        firstName: 'Tenant',
        lastName: 'Admin',
        role: 'TENANT_ADMIN',
        isActive: true,
        requiresPasswordReset: false
      }
    });

    // Teacher
    await userClient.user.upsert({
      where: { id: teacherId },
      update: { passwordHash: hashedPassword },
      create: {
        id: teacherId,
        tenantId: tenantId,
        email: 'teacher@acme.edu',
        passwordHash: hashedPassword,
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'TEACHER',
        isActive: true,
        requiresPasswordReset: false
      }
    });

    // Candidate
    await userClient.user.upsert({
      where: { id: studentId },
      update: { passwordHash: hashedPassword },
      create: {
        id: studentId,
        tenantId: tenantId,
        email: 'john.doe@student.acme.edu',
        passwordHash: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        role: 'CANDIDATE',
        isActive: true,
        requiresPasswordReset: false
      }
    });

    console.log('✅ Seeded Users (All Roles)');
    console.log('Seed completed successfully!');

  } catch (e) {
    console.error(e);
  } finally {
    await tenantClient.$disconnect();
    await userClient.$disconnect();
  }
}

main();
