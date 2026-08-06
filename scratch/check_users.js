const { PrismaClient } = require('../services/user-service/node_modules/@prisma/client/user');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const adminHash = bcrypt.hashSync('Admin@123', 10);
  
  // Update ALL user accounts in MongoDB to password Admin@123
  const updated = await prisma.user.updateMany({
    data: { passwordHash: adminHash }
  });
  console.log('Updated passwords for all users to Admin@123, count:', updated.count);

  const users = await prisma.user.findMany();
  for (const u of users) {
    const matchAdmin = await bcrypt.compare('Admin@123', u.passwordHash);
    console.log(`User: ${u.email} | Role: ${u.role} | Tenant: ${u.tenantId} | Match Admin@123: ${matchAdmin}`);
  }
  await prisma.$disconnect();
}

main();
