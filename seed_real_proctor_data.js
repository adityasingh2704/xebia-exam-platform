const { PrismaClient: UserClient } = require('./services/user-service/node_modules/@prisma/client/user');
const { PrismaClient: ExamClient } = require('./services/exam-service/node_modules/@prisma/client/exam');
const { PrismaClient: TenantClient } = require('./services/tenant-service/node_modules/@prisma/client/tenant');
const bcrypt = require('bcryptjs');

async function seedRealData() {
  const tenantClient = new TenantClient();
  const userClient = new UserClient();
  const examClient = new ExamClient();

  try {
    console.log('🚀 Synchronizing all MongoDB Tenant IDs and Real Data...');

    // 1. Tenant
    const tenant = await tenantClient.tenant.upsert({
      where: { slug: 'acme' },
      update: { status: 'ACTIVE' },
      create: {
        name: 'Acme University',
        slug: 'acme',
        status: 'ACTIVE',
        plan: 'enterprise',
        maxSeats: 500,
      },
    });
    console.log('✅ Target Tenant ID:', tenant.id, `(${tenant.slug})`);

    // 2. Clean up conflicting user accounts across old tenant IDs
    const passwordHash = bcrypt.hashSync('Admin@123', 10);
    const usersToSeed = [
      { email: 'admin@acme.edu', role: 'PLATFORM_ADMIN', firstName: 'Platform', lastName: 'Admin' },
      { email: 'tenantadmin@acme.edu', role: 'TENANT_ADMIN', firstName: 'Tenant', lastName: 'Admin' },
      { email: 'teacher@acme.edu', role: 'TEACHER', firstName: 'Acme', lastName: 'Teacher' },
      { email: 'proctor@acme.edu', role: 'PROCTOR', firstName: 'Sarah', lastName: 'Conner (Lead Proctor)' },
      { email: 'proctor@xebia.com', role: 'PROCTOR', firstName: 'Alex', lastName: 'Mercer (Senior Proctor)' },
      { email: 'john.doe@student.acme.edu', role: 'CANDIDATE', firstName: 'John', lastName: 'Doe' },
      { email: 'alex.smith@student.acme.edu', role: 'CANDIDATE', firstName: 'Alex', lastName: 'Smith' },
      { email: 'maria.garcia@student.acme.edu', role: 'CANDIDATE', firstName: 'Maria', lastName: 'Garcia' },
      { email: 'david.lee@student.acme.edu', role: 'CANDIDATE', firstName: 'David', lastName: 'Lee' },
      { email: 'sophia.chen@student.acme.edu', role: 'CANDIDATE', firstName: 'Sophia', lastName: 'Chen' },
    ];

    // Remove any user with these emails that doesn't match the target tenant ID
    for (const u of usersToSeed) {
      await userClient.user.deleteMany({
        where: {
          email: u.email,
          tenantId: { not: tenant.id },
        },
      });
    }

    const createdUsers = [];
    for (const u of usersToSeed) {
      let existing = await userClient.user.findFirst({
        where: { email: u.email, tenantId: tenant.id },
      });
      if (!existing) {
        existing = await userClient.user.create({
          data: {
            tenantId: tenant.id,
            email: u.email,
            passwordHash,
            firstName: u.firstName,
            lastName: u.lastName,
            role: u.role,
            isActive: true,
            requiresPasswordReset: false,
          },
        });
      } else {
        existing = await userClient.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            role: u.role,
            firstName: u.firstName,
            lastName: u.lastName,
            isActive: true,
          },
        });
      }
      createdUsers.push(existing);
      console.log(`✅ User synced [${u.role}]:`, u.email, `(ID: ${existing.id})`);
    }

    const proctorUser = createdUsers.find((u) => u.email === 'proctor@acme.edu');
    const candidates = createdUsers.filter((u) => u.role === 'CANDIDATE');

    // 3. Create/Update Proctored Exam
    let realExam = await examClient.exam.findFirst({
      where: { tenantId: tenant.id, title: 'Full Stack Engineering Assessment' },
    });

    if (!realExam) {
      realExam = await examClient.exam.create({
        data: {
          tenantId: tenant.id,
          title: 'Full Stack Engineering Assessment',
          description: 'Comprehensive software engineering certification exam with real-time AI and human proctoring.',
          instructions: 'Ensure your web camera and microphone are operational. Stay focused on the examination viewport.',
          status: 'PUBLISHED',
          duration: 60,
          totalMarks: 100,
          passingScore: 70,
          enableProctoring: true,
          proctoringMode: 'AI_HUMAN_REVIEW',
          proctoringFlags: ['MULTIPLE_FACES', 'NO_FACE', 'TAB_SWITCH', 'AUDIO_DETECTED', 'CAMERA_DISCONNECTED', 'DEVTOOLS_OPEN'],
          recordingConfig: 'BOTH',
          sensitivityNotifyLimit: 70,
          sensitivityWarningLimit: 50,
          sensitivityTerminationLimit: 30,
          autoTerminateOnTrustLimit: true,
          proctoringSettingsLocked: false,
          createdBy: proctorUser ? proctorUser.id : 'usr_proctor_01',
          sections: {
            create: [
              {
                title: 'Section 1: Frontend & React Architecture',
                description: 'Core concepts, state management, and performance',
                order: 1,
              },
              {
                title: 'Section 2: Backend & Database Security',
                description: 'Microservices, REST APIs, and database indexing',
                order: 2,
              },
            ],
          },
        },
      });
      console.log('✅ Created Real Proctored Exam:', realExam.id);
    } else {
      await examClient.exam.update({
        where: { id: realExam.id },
        data: { status: 'PUBLISHED', enableProctoring: true, proctoringMode: 'AI_HUMAN_REVIEW' },
      });
      console.log('✅ Exam synchronized:', realExam.id);
    }

    // Update any orphan assignments to match tenant.id
    await examClient.examAssignment.updateMany({
      where: { examId: realExam.id },
      data: { tenantId: tenant.id },
    });

    // 4. Assignments for candidates
    const assignmentPresets = [
      { candidate: candidates[0], trustScore: 95, sessionStatus: 'ACTIVE', startedOffset: 12 },
      { candidate: candidates[1], trustScore: 65, sessionStatus: 'WARNED', startedOffset: 28 },
      { candidate: candidates[2], trustScore: 45, sessionStatus: 'FLAGGED', startedOffset: 18 },
      { candidate: candidates[3], trustScore: 25, sessionStatus: 'TERMINATED', startedOffset: 42, termReason: 'Cheating / External Material Detected' },
      { candidate: candidates[4], trustScore: 100, sessionStatus: 'ACTIVE', startedOffset: 8 },
    ];

    for (const preset of assignmentPresets) {
      if (!preset.candidate) continue;

      let assignment = await examClient.examAssignment.findFirst({
        where: { examId: realExam.id, candidateId: preset.candidate.id },
      });

      if (!assignment) {
        assignment = await examClient.examAssignment.create({
          data: {
            examId: realExam.id,
            tenantId: tenant.id,
            candidateId: preset.candidate.id,
            status: preset.sessionStatus === 'TERMINATED' ? 'SUBMITTED' : 'IN_PROGRESS',
            sessionStatus: preset.sessionStatus,
            startedAt: new Date(Date.now() - preset.startedOffset * 60 * 1000),
            trustScore: preset.trustScore,
            terminationReason: preset.termReason || null,
            proctorWarnings: preset.sessionStatus === 'WARNED'
              ? JSON.stringify([{ id: 'w_01', message: 'Warning: Proctor noticed browser window focus loss.', timestamp: new Date().toISOString() }])
              : null,
          },
        });
        console.log(`✅ Created Assignment for ${preset.candidate.firstName} ${preset.candidate.lastName}:`, assignment.id);
      } else {
        assignment = await examClient.examAssignment.update({
          where: { id: assignment.id },
          data: {
            tenantId: tenant.id,
            sessionStatus: preset.sessionStatus,
            trustScore: preset.trustScore,
          },
        });
        console.log(`✅ Synced Assignment for ${preset.candidate.firstName} ${preset.candidate.lastName}:`, assignment.id);
      }
    }

    console.log('🎉 MONGODB TENANT AND CANDIDATE RECORDS FULLY SYNCHRONIZED!');
  } catch (err) {
    console.error('❌ Sync Error:', err);
  } finally {
    await tenantClient.$disconnect();
    await userClient.$disconnect();
    await examClient.$disconnect();
  }
}

seedRealData();
