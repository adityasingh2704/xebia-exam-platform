const { PrismaClient: ExamClient } = require('./services/exam-service/node_modules/@prisma/client/exam');

async function clearAssignments() {
  const ec = new ExamClient();
  try {
    console.log('🧹 Clearing all test exam assignments and incidents from MongoDB...');
    await ec.incident.deleteMany({});
    await ec.proctorDecisionLog.deleteMany({});
    await ec.examAssignment.deleteMany({});
    console.log('✅ All test exam assignments, incidents, and decision logs successfully cleared from MongoDB!');
  } catch (err) {
    console.error('Error clearing:', err.message);
  } finally {
    await ec.$disconnect();
  }
}

clearAssignments();
