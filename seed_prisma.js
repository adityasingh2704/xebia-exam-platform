const { PrismaClient: UserClient } = require('./services/user-service/node_modules/@prisma/client/user');
const { PrismaClient: TenantClient } = require('./services/tenant-service/node_modules/@prisma/client/tenant');
const bcrypt = require('bcryptjs');

async function seed() {
  const tenantClient = new TenantClient();
  const userClient = new UserClient();

  try {
    console.log('Connected to Prisma clients...');
    const acmeTenant = await tenantClient.tenant.upsert({
      where: { slug: 'acme' },
      update: {},
      create: {
        name: 'Acme University',
        slug: 'acme',
        status: 'ACTIVE'
      }
    });
    console.log('Upserted tenant:', acmeTenant.slug);

    const passwordHash = bcrypt.hashSync('Admin@123', 10);
    const users = [
      { email: 'admin@acme.edu', role: 'PLATFORM_ADMIN', firstName: 'Platform', lastName: 'Admin' },
      { email: 'tenantadmin@acme.edu', role: 'TENANT_ADMIN', firstName: 'Tenant', lastName: 'Admin' },
      { email: 'teacher@acme.edu', role: 'TEACHER', firstName: 'Acme', lastName: 'Teacher' },
      { email: 'proctor@acme.edu', role: 'PROCTOR', firstName: 'Sarah', lastName: 'Conner (Proctor)' },
      { email: 'proctor@xebia.com', role: 'PROCTOR', firstName: 'Lead', lastName: 'Proctor' },
      { email: 'john.doe@student.acme.edu', role: 'CANDIDATE', firstName: 'John', lastName: 'Doe' },
      { email: 'alex.smith@student.acme.edu', role: 'CANDIDATE', firstName: 'Alex', lastName: 'Smith' },
      { email: 'maria.garcia@student.acme.edu', role: 'CANDIDATE', firstName: 'Maria', lastName: 'Garcia' },
    ];

    for (const u of users) {
      await userClient.user.upsert({
        where: { email_tenantId: { email: u.email, tenantId: acmeTenant.id } },
        update: {
          passwordHash,
          isActive: true
        },
        create: {
          tenantId: acmeTenant.id,
          email: u.email,
          passwordHash,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          isActive: true,
          requiresPasswordReset: false
        }
      });
      console.log('Upserted user:', u.email);
    }

    console.log('Seeding complete successfully via Prisma!');
  } catch (err) {
    console.error('Seed Error:', err);
  } finally {
    await tenantClient.$disconnect();
    await userClient.$disconnect();
  }
}

seed();
