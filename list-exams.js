const { PrismaClient } = require('./services/exam-service/node_modules/@prisma/client/exam/index.js'); 
const pc = new PrismaClient(); 

async function main() { 
  const exams = await pc.exam.findMany({}); 
  console.log('Exams in DB:', exams); 
} 
main().finally(() => pc.$disconnect());
