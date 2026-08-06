const { PrismaClient } = require('./services/user-service/node_modules/@prisma/client/user/index.js'); 
const pc = new PrismaClient(); 

async function main() { 
  const users = await pc.user.findMany({}); 
  console.log('Users in DB:', users); 
} 
main().finally(() => pc.$disconnect());
