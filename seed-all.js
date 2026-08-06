const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const uri = 'mongodb+srv://adityasinghasks_db_user:XERECRUIT123456@cluster0.79ua2y5.mongodb.net/?appName=Cluster0';

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB. Seeding databases...');

    // 1. Seed Tenant
    const tenantDb = client.db('xe_tenant');
    const tenantId = '6a5a9a57d6c9c2daf29ce83f';
    await tenantDb.collection('tenants').updateOne(
      { _id: tenantId },
      {
        $set: {
          _id: tenantId,
          name: 'Acme University',
          domain: 'acme.edu',
          status: 'ACTIVE',
          subscriptionTier: 'ENTERPRISE',
          features: [],
          maxUsers: 500,
          slug: 'acme-university',
          created_at: new Date(),
          updated_at: new Date()
        }
      },
      { upsert: true }
    );

    await tenantDb.collection('tenant_branding').updateOne(
      { tenant_id: tenantId },
      {
        $set: {
          tenant_id: tenantId,
          primary_color: '#2563eb',
          created_at: new Date(),
          updated_at: new Date()
        }
      },
      { upsert: true }
    );
    console.log('✅ Seeded Tenant');

    // 2. Seed Users
    const userDb = client.db('xe_user');
    const teacherId = '6a5a9a580d2754e0b63465ba';
    const studentId = '6a5a9a580d2754e0b63465bb';
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    await userDb.collection('users').updateOne(
      { _id: teacherId },
      {
        $set: {
          _id: teacherId,
          tenant_id: tenantId,
          email: 'teacher@acme.edu',
          password_hash: hashedPassword,
          first_name: 'Jane',
          last_name: 'Smith',
          role: 'TEACHER',
          is_active: true,
          requires_password_reset: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      },
      { upsert: true }
    );

    await userDb.collection('users').updateOne(
      { _id: studentId },
      {
        $set: {
          _id: studentId,
          tenant_id: tenantId,
          email: 'john.doe@student.acme.edu',
          password_hash: hashedPassword,
          first_name: 'John',
          last_name: 'Doe',
          role: 'CANDIDATE',
          is_active: true,
          requires_password_reset: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      },
      { upsert: true }
    );
    console.log('✅ Seeded Users');

    console.log('Seed completed successfully!');

  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

main();
