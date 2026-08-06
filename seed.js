const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const uri = 'mongodb+srv://adityasinghasks_db_user:1234567890@cluster0.v9uusui.mongodb.net/?appName=Cluster0';

async function seed() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    // 1. Seed Tenant
    const tenantDb = client.db('xe_tenant');
    const tenantId = new ObjectId().toString();
    const acmeTenant = {
      _id: new ObjectId(tenantId),
      name: 'Acme University',
      slug: 'acme',
      domain: 'acme.edu',
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    // Check if exists
    const existingTenant = await tenantDb.collection('tenants').findOne({ slug: 'acme' });
    if (!existingTenant) {
      await tenantDb.collection('tenants').insertOne(acmeTenant);
      console.log('Created ACME tenant');
    } else {
      console.log('Tenant exists, using its ID');
      acmeTenant._id = existingTenant._id;
    }

    // 2. Seed Users
    const userDb = client.db('xe_user');
    const password_hash = bcrypt.hashSync('Admin@123', 10);
    const tenant_id = acmeTenant._id.toString();

    const users = [
      { email: 'admin@acme.edu', role: 'PLATFORM_ADMIN', first_name: 'Platform', last_name: 'Admin' },
      { email: 'tenantadmin@acme.edu', role: 'TENANT_ADMIN', first_name: 'Tenant', last_name: 'Admin' },
      { email: 'teacher@acme.edu', role: 'TEACHER', first_name: 'Acme', last_name: 'Teacher' },
      { email: 'john.doe@student.acme.edu', role: 'CANDIDATE', first_name: 'John', last_name: 'Doe' },
    ];

    for (const u of users) {
      const exists = await userDb.collection('users').findOne({ email: u.email });
      if (!exists) {
        await userDb.collection('users').insertOne({
          _id: new ObjectId(),
          tenant_id,
          email: u.email,
          password_hash,
          first_name: u.first_name,
          last_name: u.last_name,
          role: u.role,
          is_active: true,
          requires_password_reset: false,
          created_at: new Date(),
          updated_at: new Date(),
        });
        console.log(`Created user: ${u.email}`);
      } else {
        console.log(`User ${u.email} already exists`);
      }
    }

    console.log('Seeding complete!');
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

seed();
