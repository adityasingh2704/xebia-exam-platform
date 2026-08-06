const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'mongodb+srv://adityasinghasks_db_user:XERECRUIT123456@cluster0.79ua2y5.mongodb.net/xe_exam?retryWrites=true&w=majority' } } });

async function main() {
  const exams = await prisma.exam.findMany();
  console.log('Exams found:', exams.length);

  for (const exam of exams) {
    console.log('Assigning candidate to exam:', exam.title);
    await prisma.examAssignment.upsert({
      where: {
        examId_candidateId: {
          examId: exam.id,
          candidateId: '6a5a9a580d2754e0b63465bb' // test candidate ID
        }
      },
      update: {},
      create: {
        id: require('crypto').randomBytes(12).toString('hex'),
        examId: exam.id,
        candidateId: '6a5a9a580d2754e0b63465bb',
        tenantId: '6a5a9a57d6c9c2daf29ce83f',
        status: 'ASSIGNED',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  const assignments = await prisma.examAssignment.findMany();
  console.log('Total Assignments:', assignments.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
