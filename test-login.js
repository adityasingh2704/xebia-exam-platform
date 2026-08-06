const bcrypt = require('bcryptjs'); 
const { PrismaClient } = require('./services/user-service/node_modules/@prisma/client/user/index.js'); 
const pc = new PrismaClient(); 

async function main() { 
  const user = await pc.user.findFirst({ where: { email: 'teacher@acme.edu' } }); 
  console.log(user); 
  if (user) {
    const valid = await bcrypt.compare('Password123!', user.passwordHash); 
    console.log('Password valid:', valid); 
  }
} 
main().finally(() => pc.$disconnect());
