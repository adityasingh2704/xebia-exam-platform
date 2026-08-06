/**
 * Xe-Recruiters — Database Seed Script
 * Seeds all 5 databases with realistic demo data for a working prototype.
 * Run with: node scripts/seed.js
 */

const { execSync } = require('child_process');
const path = require('path');

// Colours for output
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

function log(color, msg) {
  console.log(`${color}${msg}${RESET}`);
}

// ── Individual service seeders ──────────────────────────────────────────

async function seedTenant() {
  log(BLUE, '\n[1/5] Seeding tenant database...');
  const { PrismaClient } = require(path.join(__dirname, '../services/tenant-service/node_modules/@prisma/client/tenant'));
  const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://xe_admin:xe_secret_2024@localhost:5432/xe_tenant' } },
  });

  try {
    const existing = await prisma.tenant.findFirst({ where: { slug: 'acme-university' } });
    if (!existing) {
      const tenant = await prisma.tenant.create({
        data: {
          name: 'ACME University',
          slug: 'acme-university',
          status: 'ACTIVE',
          plan: 'enterprise',
          maxSeats: 500,
          usedSeats: 12,
          branding: {
            create: {
              primaryColor: '#6C1D5F',
              secondaryColor: '#FF6200',
              companyName: 'ACME University',
            },
          },
          settings: {
            create: {
              timezone: 'Asia/Kolkata',
              locale: 'en-IN',
              dateFormat: 'DD/MM/YYYY',
              enableEmailNotifications: true,
              enableInAppNotifications: true,
              enableProctoring: true,
              maxConcurrentExams: 25,
            },
          },
        },
      });
      log(GREEN, `  ✓ Created tenant: ${tenant.name} (${tenant.slug})`);

      // Second tenant
      await prisma.tenant.create({
        data: {
          name: 'Tech Corp Certification',
          slug: 'techcorp-cert',
          status: 'ACTIVE',
          plan: 'professional',
          maxSeats: 100,
          usedSeats: 34,
          branding: {
            create: { primaryColor: '#1a56db', secondaryColor: '#f05252', companyName: 'TechCorp' },
          },
          settings: { create: { timezone: 'America/New_York', locale: 'en-US', dateFormat: 'MM/DD/YYYY' } },
        },
      });
      log(GREEN, '  ✓ Created tenant: Tech Corp Certification');
    } else {
      log(YELLOW, '  ⚠ Tenants already seeded — skipping');
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function seedUsers() {
  log(BLUE, '\n[2/5] Seeding user database...');
  const { PrismaClient } = require(path.join(__dirname, '../services/user-service/node_modules/@prisma/client/user'));
  const bcrypt = require(path.join(__dirname, '../node_modules/bcryptjs'));
  const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://xe_admin:xe_secret_2024@localhost:5432/xe_user' } },
  });

  const TENANT_ID = 'seed-tenant-acme'; // Virtual ID (real FK would be UUID from tenant DB)
  const PASSWORD_HASH = await bcrypt.hash('Admin@123', 10);

  const users = [
    { email: 'admin@acme.edu', firstName: 'Platform', lastName: 'Admin', role: 'PLATFORM_ADMIN', requiresPasswordReset: false },
    { email: 'tenantadmin@acme.edu', firstName: 'Sarah', lastName: 'Johnson', role: 'TENANT_ADMIN', requiresPasswordReset: false },
    { email: 'exammanager@acme.edu', firstName: 'Michael', lastName: 'Chen', role: 'EXAM_MANAGER', requiresPasswordReset: false },
    { email: 'teacher@acme.edu', firstName: 'Priya', lastName: 'Sharma', role: 'TEACHER', requiresPasswordReset: false },
    { email: 'proctor@acme.edu', firstName: 'Rahul', lastName: 'Verma', role: 'PROCTOR', requiresPasswordReset: false },
    { email: 'john.doe@student.acme.edu', firstName: 'John', lastName: 'Doe', role: 'CANDIDATE', requiresPasswordReset: false },
    { email: 'jane.smith@student.acme.edu', firstName: 'Jane', lastName: 'Smith', role: 'CANDIDATE', requiresPasswordReset: false },
    { email: 'alex.r@student.acme.edu', firstName: 'Alex', lastName: 'Rivera', role: 'CANDIDATE', requiresPasswordReset: false },
    { email: 'emma.w@student.acme.edu', firstName: 'Emma', lastName: 'Watson', role: 'CANDIDATE', requiresPasswordReset: false },
    { email: 'ryan.g@student.acme.edu', firstName: 'Ryan', lastName: 'Gosling', role: 'CANDIDATE', requiresPasswordReset: false },
  ];

  try {
    const existing = await prisma.user.findFirst({ where: { email: 'admin@acme.edu' } });
    if (!existing) {
      for (const u of users) {
        await prisma.user.create({
          data: { ...u, tenantId: TENANT_ID, passwordHash: PASSWORD_HASH },
        });
        log(GREEN, `  ✓ Created user: ${u.email} (${u.role})`);
      }
    } else {
      log(YELLOW, '  ⚠ Users already seeded — skipping');
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function seedQuestions() {
  log(BLUE, '\n[3/5] Seeding question bank...');
  const { PrismaClient } = require(path.join(__dirname, '../services/question-bank-service/node_modules/@prisma/client/question'));
  const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://xe_admin:xe_secret_2024@localhost:5432/xe_question' } },
  });

  const TENANT_ID = 'seed-tenant-acme';
  const CREATED_BY = 'seed-teacher';

  try {
    const existing = await prisma.question.findFirst({ where: { tenantId: TENANT_ID } });
    if (!existing) {
      // Create category first
      const category = await prisma.category.create({
        data: { tenantId: TENANT_ID, name: 'Data Structures & Algorithms' },
      });

      const questions = [
        {
          type: 'MCQ', title: 'Binary Search Time Complexity',
          body: 'What is the time complexity of binary search on a sorted array of n elements?',
          difficulty: 'EASY', points: 5,
          explanation: 'Binary search divides the search space in half at each step, giving O(log n) time complexity.',
          options: { create: [
            { text: 'O(n)', isCorrect: false, order: 1 },
            { text: 'O(log n)', isCorrect: true, order: 2 },
            { text: 'O(n log n)', isCorrect: false, order: 3 },
            { text: 'O(1)', isCorrect: false, order: 4 },
          ]},
          tags: { create: [{ tag: 'algorithms' }, { tag: 'searching' }, { tag: 'complexity' }] },
        },
        {
          type: 'MCQ', title: 'Stack vs Queue',
          body: 'Which data structure follows LIFO (Last In First Out) principle?',
          difficulty: 'EASY', points: 5,
          options: { create: [
            { text: 'Queue', isCorrect: false, order: 1 },
            { text: 'Stack', isCorrect: true, order: 2 },
            { text: 'Heap', isCorrect: false, order: 3 },
            { text: 'Linked List', isCorrect: false, order: 4 },
          ]},
          tags: { create: [{ tag: 'data-structures' }, { tag: 'stack' }] },
        },
        {
          type: 'MCQ', title: 'QuickSort Average Case',
          body: 'What is the average-case time complexity of QuickSort?',
          difficulty: 'MEDIUM', points: 10,
          options: { create: [
            { text: 'O(n²)', isCorrect: false, order: 1 },
            { text: 'O(n log n)', isCorrect: true, order: 2 },
            { text: 'O(n)', isCorrect: false, order: 3 },
            { text: 'O(log n)', isCorrect: false, order: 4 },
          ]},
          tags: { create: [{ tag: 'sorting' }, { tag: 'algorithms' }] },
        },
        {
          type: 'TRUE_FALSE', title: 'Linked List Random Access',
          body: 'A singly linked list supports O(1) random access to any element.',
          difficulty: 'EASY', points: 3,
          explanation: 'False — linked lists require O(n) traversal to reach an arbitrary index.',
          options: { create: [
            { text: 'True', isCorrect: false, order: 1 },
            { text: 'False', isCorrect: true, order: 2 },
          ]},
          tags: { create: [{ tag: 'linked-list' }, { tag: 'data-structures' }] },
        },
        {
          type: 'MRQ', title: 'Graph Traversal Algorithms',
          body: 'Which of the following are graph traversal algorithms? (Select all that apply)',
          difficulty: 'MEDIUM', points: 10,
          options: { create: [
            { text: 'Breadth-First Search (BFS)', isCorrect: true, order: 1 },
            { text: 'Depth-First Search (DFS)', isCorrect: true, order: 2 },
            { text: 'QuickSort', isCorrect: false, order: 3 },
            { text: "Dijkstra's Algorithm", isCorrect: true, order: 4 },
          ]},
          tags: { create: [{ tag: 'graphs' }, { tag: 'bfs' }, { tag: 'dfs' }] },
        },
        {
          type: 'MCQ', title: 'Hash Table Average Lookup',
          body: 'What is the average-case time complexity for lookup in a hash table?',
          difficulty: 'MEDIUM', points: 8,
          options: { create: [
            { text: 'O(n)', isCorrect: false, order: 1 },
            { text: 'O(log n)', isCorrect: false, order: 2 },
            { text: 'O(1)', isCorrect: true, order: 3 },
            { text: 'O(n²)', isCorrect: false, order: 4 },
          ]},
          tags: { create: [{ tag: 'hash-table' }, { tag: 'complexity' }] },
        },
        {
          type: 'PROGRAMMING', title: 'Two Sum Problem',
          body: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers that add up to \`target\`.

\`\`\`
Input: nums = [2, 7, 11, 15], target = 9
Output: [0, 1]
Explanation: nums[0] + nums[1] = 2 + 7 = 9
\`\`\`

Write a function \`twoSum(nums, target)\` that solves this problem in O(n) time.`,
          difficulty: 'EASY', points: 20,
          explanation: 'Use a hash map to store values we have seen and their indices. For each element, check if its complement exists.',
          tags: { create: [{ tag: 'programming' }, { tag: 'arrays' }, { tag: 'hash-map' }] },
        },
        {
          type: 'PROGRAMMING', title: 'Fibonacci with Memoization',
          body: `Implement a function \`fib(n)\` that computes the nth Fibonacci number using memoization.

\`\`\`
fib(0) = 0
fib(1) = 1
fib(10) = 55
fib(20) = 6765
\`\`\`

Your solution should run in O(n) time.`,
          difficulty: 'MEDIUM', points: 25,
          tags: { create: [{ tag: 'programming' }, { tag: 'dynamic-programming' }, { tag: 'recursion' }] },
        },
        {
          type: 'MCQ', title: 'Red-Black Tree Property',
          body: 'Which of the following is NOT a property of a Red-Black Tree?',
          difficulty: 'HARD', points: 15,
          options: { create: [
            { text: 'Every node is either red or black', isCorrect: false, order: 1 },
            { text: 'Root is always black', isCorrect: false, order: 2 },
            { text: 'Red nodes can have red children', isCorrect: true, order: 3 },
            { text: 'All null leaves are black', isCorrect: false, order: 4 },
          ]},
          tags: { create: [{ tag: 'trees' }, { tag: 'balanced-bst' }] },
        },
        {
          type: 'ESSAY', title: 'Trade-offs: Arrays vs Linked Lists',
          body: 'Describe the key trade-offs between arrays and linked lists in terms of time complexity for common operations (access, insertion, deletion). When would you choose one over the other in a real application?',
          difficulty: 'MEDIUM', points: 20,
          tags: { create: [{ tag: 'essay' }, { tag: 'data-structures' }, { tag: 'trade-offs' }] },
        },
      ];

      for (const q of questions) {
        await prisma.question.create({
          data: { ...q, tenantId: TENANT_ID, createdBy: CREATED_BY, categoryId: category.id },
        });
        log(GREEN, `  ✓ Created question: ${q.title}`);
      }
    } else {
      log(YELLOW, '  ⚠ Questions already seeded — skipping');
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function seedExams() {
  log(BLUE, '\n[4/5] Seeding exam database...');
  const { PrismaClient } = require(path.join(__dirname, '../services/exam-service/node_modules/@prisma/client/exam'));
  const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://xe_admin:xe_secret_2024@localhost:5432/xe_exam' } },
  });

  const TENANT_ID = 'seed-tenant-acme';
  const CREATED_BY = 'seed-teacher';

  try {
    const existing = await prisma.exam.findFirst({ where: { tenantId: TENANT_ID } });
    if (!existing) {
      const exams = [
        {
          title: 'Data Structures & Algorithms — Midterm',
          description: 'Comprehensive mid-semester assessment covering arrays, linked lists, stacks, queues, and trees.',
          status: 'PUBLISHED',
          duration: 90, totalMarks: 100, passingScore: 60,
          enableProctoring: true, shuffleQuestions: true, maxAttempts: 1,
          navigationRule: 'LINEAR',
          sections: { create: [{ title: 'Conceptual Questions', description: 'MCQ and True/False', order: 1 }] },
        },
        {
          title: 'Programming Assessment — Python Basics',
          description: 'Hands-on programming exam covering Python fundamentals and problem-solving.',
          status: 'DRAFT',
          duration: 120, totalMarks: 150, passingScore: 75,
          enableProctoring: true, shuffleQuestions: false, maxAttempts: 1,
          navigationRule: 'FREE',
          sections: { create: [
            { title: 'Multiple Choice', description: 'Theory questions', order: 1 },
            { title: 'Coding Problems', description: 'Live coding tasks', order: 2 },
          ]},
        },
        {
          title: 'Web Development — JavaScript Fundamentals',
          description: 'Assessment on JavaScript ES6+, DOM manipulation, and async programming.',
          status: 'SCHEDULED',
          duration: 60, totalMarks: 80, passingScore: 48,
          startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
          enableProctoring: true, shuffleQuestions: true, maxAttempts: 2,
          navigationRule: 'FREE',
          sections: { create: [{ title: 'JavaScript Core', description: 'ES6+ questions', order: 1 }] },
        },
        {
          title: 'Database Management Systems — Final',
          description: 'Comprehensive exam covering relational databases, SQL, normalization, and transactions.',
          status: 'COMPLETED',
          duration: 120, totalMarks: 200, passingScore: 120,
          enableProctoring: true, shuffleQuestions: true, maxAttempts: 1,
          navigationRule: 'SECTION_LOCKED',
          sections: { create: [
            { title: 'SQL Fundamentals', description: 'Basic and advanced SQL', order: 1 },
            { title: 'Normalization & Design', description: 'Schema design questions', order: 2 },
          ]},
        },
        {
          title: 'Computer Networks — Quiz 1',
          description: 'Short quiz on OSI model, TCP/IP, and networking protocols.',
          status: 'DRAFT',
          duration: 30, totalMarks: 50, passingScore: 30,
          enableProctoring: false, shuffleQuestions: true, maxAttempts: 2,
          navigationRule: 'FREE',
          sections: { create: [{ title: 'Networking Basics', description: 'OSI and protocols', order: 1 }] },
        },
      ];

      for (const exam of exams) {
        const created = await prisma.exam.create({
          data: { ...exam, tenantId: TENANT_ID, createdBy: CREATED_BY },
        });
        log(GREEN, `  ✓ Created exam: ${created.title} [${created.status}]`);
      }
    } else {
      log(YELLOW, '  ⚠ Exams already seeded — skipping');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  log(BLUE, '╔════════════════════════════════════════╗');
  log(BLUE, '║     Xe-Recruiters — Database Seed      ║');
  log(BLUE, '╚════════════════════════════════════════╝');

  try {
    await seedTenant();
    await seedUsers();
    await seedQuestions();
    await seedExams();

    log(GREEN, '\n╔════════════════════════════════════════╗');
    log(GREEN, '║       ✅ Seed completed successfully!   ║');
    log(GREEN, '╠════════════════════════════════════════╣');
    log(GREEN, '║  Demo Login Credentials:               ║');
    log(GREEN, '║  Platform Admin: admin@acme.edu        ║');
    log(GREEN, '║  Tenant Admin:   tenantadmin@acme.edu  ║');
    log(GREEN, '║  Teacher:        teacher@acme.edu      ║');
    log(GREEN, '║  Password (all): Admin@123             ║');
    log(GREEN, '╚════════════════════════════════════════╝\n');
  } catch (err) {
    log(RED, `\n✗ Seed failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

main();
