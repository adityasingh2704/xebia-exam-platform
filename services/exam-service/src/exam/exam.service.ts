import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { successResponse, createPaginatedResponse, generateId } from '@xe-recruiters/shared-utils';
import { CertificateService } from '../certificate/certificate.service';

@Injectable()
export class ExamService {
  private readonly logger = new Logger(ExamService.name);

  constructor(
    private prisma: PrismaService,
    private certificateService: CertificateService,
  ) { }

  async create(dto: any) {
    const tenantId = dto.tenantId;
    const createdBy = dto.createdBy || 'Teacher';

    const exam = await this.prisma.exam.create({
      data: {
        id: generateId(),
        tenantId,
        title: dto.title,
        description: dto.description,
        instructions: dto.instructions,
        duration: dto.duration || 60,
        totalMarks: dto.totalMarks || 100,
        passingScore: dto.passingScore || 60,
        startTime: dto.startTime ? new Date(dto.startTime) : null,
        endTime: dto.endTime ? new Date(dto.endTime) : null,
        navigationRule: dto.navigationRule || 'FREE',
        shuffleQuestions: dto.shuffleQuestions || false,
        shuffleOptions: dto.shuffleOptions || false,
        showResults: dto.showResults !== false,
        enableProctoring: dto.enableProctoring !== false,
        proctoringMode: dto.proctoringMode || 'AI_ONLY',
        proctoringFlags: dto.proctoringFlags || ['FACE_ABSENCE', 'MULTIPLE_FACES', 'GAZE_AWAY', 'MOBILE_PHONE', 'TAB_SWITCH', 'CLIPBOARD'],
        recordingConfig: dto.recordingConfig || 'WEBCAM_ONLY',
        sensitivityWarningLimit: dto.sensitivityWarningLimit !== undefined ? parseInt(dto.sensitivityWarningLimit) : 3,
        sensitivityTerminationLimit: dto.sensitivityTerminationLimit !== undefined ? parseInt(dto.sensitivityTerminationLimit) : 10,
        proctoringSettingsLocked: dto.proctoringSettingsLocked === true || dto.proctoringSettingsLocked === 'true',
        maxAttempts: dto.maxAttempts || 1,
        negativeMarking: dto.negativeMarking === true || dto.negativeMarking === 'true',
        negativeMarkValue: dto.negativeMarkValue !== undefined ? parseFloat(dto.negativeMarkValue) : 0.0,
        certificateIssuance: dto.certificateIssuance === true || dto.certificateIssuance === 'true',
        createdBy,
        sections: dto.sections
          ? {
            create: dto.sections.map((s: any, idx: number) => ({
              id: generateId(),
              title: s.title,
              description: s.description,
              order: s.order ?? idx + 1,
              timeLimit: s.timeLimit,
              questions: s.questionIds
                ? {
                  create: s.questionIds.map((qId: string, qIdx: number) => ({
                    id: generateId(),
                    questionId: qId,
                    order: qIdx + 1,
                  })),
                }
                : undefined,
            })),
          }
          : undefined,
      },
      include: {
        sections: {
          include: { questions: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    this.logger.log(`Exam created: ${exam.title} (${exam.id})`);
    return successResponse(exam);
  }

  async findAll(
    tenantId: string,
    page: number = 1,
    limit: number = 20,
    status?: string,
    search?: string,
    candidateId?: string,
  ) {
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    } else {
      where.status = { not: 'ARCHIVED' };
    }
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    if (candidateId) {
      if (status === 'COMPLETED') {
        where.assignments = {
          some: {
            candidateId,
            status: { in: ['SUBMITTED', 'GRADED'] },
          },
        };
        delete where.status;
      } else {
        where.assignments = {
          some: {
            candidateId,
            status: { notIn: ['SUBMITTED', 'GRADED'] },
          },
        };
        if (!status) {
          where.status = { notIn: ['DRAFT', 'ARCHIVED'] };
        }
      }
    }

    let [exams, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          sections: { include: { questions: true } },
          assignments: candidateId ? { where: { candidateId } } : true,
          _count: { select: { assignments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.exam.count({ where }),
    ]);

    if (total === 0 && candidateId && status !== 'COMPLETED') {
      const candidateFallbackWhere: any = {
        status: { in: ['PUBLISHED', 'SCHEDULED', 'IN_PROGRESS'] },
        assignments: {
          none: {
            candidateId,
            status: { in: ['SUBMITTED', 'GRADED'] },
          },
        },
      };
      if (where.tenantId) candidateFallbackWhere.tenantId = where.tenantId;

      [exams, total] = await Promise.all([
        this.prisma.exam.findMany({
          where: candidateFallbackWhere,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            sections: { include: { questions: true } },
            assignments: { where: { candidateId } },
            _count: { select: { assignments: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.exam.count({ where: candidateFallbackWhere }),
      ]);
    } else if (total === 0 && where.tenantId) {
      const fallbackWhere = { ...where };
      delete fallbackWhere.tenantId;
      [exams, total] = await Promise.all([
        this.prisma.exam.findMany({
          where: fallbackWhere,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            sections: { include: { questions: true } },
            assignments: true,
            _count: { select: { assignments: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.exam.count({ where: fallbackWhere }),
      ]);
    }

    return successResponse(createPaginatedResponse(exams, total, page, limit));
  }

  async findById(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        sections: {
          include: { questions: true },
          orderBy: { order: 'asc' },
        },
        assignments: true,
        _count: { select: { assignments: true } },
      },
    });

    if (!exam) throw new NotFoundException(`Exam '${id}' not found`);
    return successResponse(exam);
  }

  async update(id: string, dto: any) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException(`Exam '${id}' not found`);

    if (exam.status !== 'DRAFT' && exam.status !== 'PUBLISHED') {
      throw new BadRequestException('Can only edit DRAFT or PUBLISHED exams');
    }

    const updated = await this.prisma.exam.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.instructions !== undefined && { instructions: dto.instructions }),
        ...(dto.duration && { duration: dto.duration }),
        ...(dto.totalMarks && { totalMarks: dto.totalMarks }),
        ...(dto.passingScore && { passingScore: dto.passingScore }),
        ...(dto.startTime && { startTime: new Date(dto.startTime) }),
        ...(dto.endTime && { endTime: new Date(dto.endTime) }),
        ...(dto.navigationRule && { navigationRule: dto.navigationRule }),
        ...(dto.shuffleQuestions !== undefined && { shuffleQuestions: dto.shuffleQuestions }),
        ...(dto.shuffleOptions !== undefined && { shuffleOptions: dto.shuffleOptions }),
        ...(dto.showResults !== undefined && { showResults: dto.showResults }),
        ...(dto.enableProctoring !== undefined && { enableProctoring: dto.enableProctoring }),
        ...(dto.proctoringMode !== undefined && { proctoringMode: dto.proctoringMode }),
        ...(dto.proctoringFlags !== undefined && { proctoringFlags: dto.proctoringFlags }),
        ...(dto.recordingConfig !== undefined && { recordingConfig: dto.recordingConfig }),
        ...(dto.sensitivityWarningLimit !== undefined && { sensitivityWarningLimit: parseInt(dto.sensitivityWarningLimit) }),
        ...(dto.sensitivityTerminationLimit !== undefined && { sensitivityTerminationLimit: parseInt(dto.sensitivityTerminationLimit) }),
        ...(dto.proctoringSettingsLocked !== undefined && { proctoringSettingsLocked: dto.proctoringSettingsLocked === true || dto.proctoringSettingsLocked === 'true' }),
        ...(dto.maxAttempts && { maxAttempts: dto.maxAttempts }),
        ...(dto.negativeMarking !== undefined && { negativeMarking: dto.negativeMarking === true || dto.negativeMarking === 'true' }),
        ...(dto.negativeMarkValue !== undefined && { negativeMarkValue: parseFloat(dto.negativeMarkValue) }),
        ...(dto.certificateIssuance !== undefined && { certificateIssuance: dto.certificateIssuance === true || dto.certificateIssuance === 'true' }),
      },
      include: { sections: { include: { questions: true } } },
    });

    return successResponse(updated);
  }

  async publish(id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException(`Exam '${id}' not found`);

    if (exam.status !== 'DRAFT') {
      throw new BadRequestException('Can only publish DRAFT exams');
    }

    const status = exam.startTime && exam.startTime > new Date() ? 'SCHEDULED' : 'PUBLISHED';

    const updated = await this.prisma.exam.update({
      where: { id },
      data: { status, publishedAt: new Date() },
    });

    this.logger.log(`Exam published: ${exam.title} → ${status}`);
    return successResponse(updated);
  }

  async addSection(examId: string, dto: any) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException(`Exam '${examId}' not found`);

    const sectionCount = await this.prisma.examSection.count({ where: { examId } });

    const section = await this.prisma.examSection.create({
      data: {
        id: generateId(),
        examId,
        title: dto.title,
        description: dto.description,
        order: dto.order ?? sectionCount + 1,
        timeLimit: dto.timeLimit,
      },
    });

    return successResponse(section);
  }

  async updateSection(sectionId: string, dto: any) {
    const section = await this.prisma.examSection.findUnique({ where: { id: sectionId } });
    if (!section) throw new NotFoundException(`Section '${sectionId}' not found`);

    const updated = await this.prisma.examSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.order && { order: dto.order }),
        ...(dto.timeLimit !== undefined && { timeLimit: dto.timeLimit }),
      },
    });

    return successResponse(updated);
  }

  async addQuestionsToSection(sectionId: string, questionIds: string[]) {
    const section = await this.prisma.examSection.findUnique({ where: { id: sectionId } });
    if (!section) throw new NotFoundException(`Section '${sectionId}' not found`);

    const existingCount = await this.prisma.examSectionQuestion.count({
      where: { sectionId },
    });

    const questions = await this.prisma.examSectionQuestion.createMany({
      data: questionIds.map((qId, idx) => ({
        id: generateId(),
        sectionId,
        questionId: qId,
        order: existingCount + idx + 1,
      })),
    });

    return successResponse({ added: questions.count });
  }

  async assignCandidates(examId: string, dto: any) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException(`Exam '${examId}' not found`);

    const candidateIds: string[] = dto.candidateIds || [];
    const candidates: Array<{ id: string; timeMultiplier?: number; extraTimeMinutes?: number }> = dto.candidates || [];

    const data = [];
    if (candidates.length > 0) {
      candidates.forEach((c) => {
        data.push({
          id: generateId(),
          examId,
          tenantId: exam.tenantId,
          candidateId: c.id,
          timeMultiplier: c.timeMultiplier !== undefined ? parseFloat(c.timeMultiplier as any) : 1.0,
          extraTimeMinutes: c.extraTimeMinutes !== undefined ? parseInt(c.extraTimeMinutes as any) : 0,
        });
      });
    } else {
      candidateIds.forEach((candidateId) => {
        data.push({
          id: generateId(),
          examId,
          tenantId: exam.tenantId,
          candidateId,
          timeMultiplier: 1.0,
          extraTimeMinutes: 0,
        });
      });
    }

    const assignments = await this.prisma.examAssignment.createMany({
      data,
    });

    this.logger.log(`${assignments.count} candidates assigned to exam ${examId}`);
    return successResponse({ assigned: assignments.count });
  }

  async getAssignments(examId: string) {
    const assignments = await this.prisma.examAssignment.findMany({
      where: { examId },
      orderBy: { assignedAt: 'desc' },
    });

    return successResponse(assignments);
  }

  async updateAssignment(assignmentId: string, dto: { timeMultiplier?: number; extraTimeMinutes?: number }) {
    const updated = await this.prisma.examAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(dto.timeMultiplier !== undefined && { timeMultiplier: parseFloat(dto.timeMultiplier as any) }),
        ...(dto.extraTimeMinutes !== undefined && { extraTimeMinutes: parseInt(dto.extraTimeMinutes as any) }),
      },
    });
    return successResponse(updated);
  }

  async archive(id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException(`Exam '${id}' not found`);

    await this.prisma.exam.delete({
      where: { id },
    });

    return successResponse({ message: 'Exam deleted' });
  }

  async submitExam(examId: string, candidateId: string, answers: string, totalMarks?: number) {
    let exam = null;
    try {
      exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    } catch (e) { }

    let assignment = await this.prisma.examAssignment.findFirst({
      where: {
        OR: [
          { examId, candidateId },
          { id: examId },
        ],
      },
      include: { exam: true },
    });

    if (!exam && assignment?.exam) {
      exam = assignment.exam;
    }

    const effectiveTenantId = exam?.tenantId || assignment?.tenantId || 'tenant_acme_001';
    const effectiveExamId = exam?.id || assignment?.examId || examId;

    if (!assignment) {
      const assignmentId = generateId();
      try {
        assignment = await this.prisma.examAssignment.create({
          data: {
            id: assignmentId,
            examId: effectiveExamId,
            candidateId: candidateId || 'candidate_id',
            tenantId: effectiveTenantId,
            status: 'IN_PROGRESS',
            sessionStatus: 'ACTIVE',
            attemptsUsed: 0,
            totalMarks: totalMarks ?? exam?.totalMarks ?? 100,
            assignedAt: new Date(),
          },
          include: { exam: true },
        });
      } catch (e) {
        // Fallback search
        assignment = await this.prisma.examAssignment.findFirst({
          where: { examId: effectiveExamId },
          include: { exam: true },
        });
      }
    }

    if (!assignment) {
      throw new NotFoundException(`Assignment for exam '${examId}' and candidate '${candidateId}' not found`);
    }

    if (assignment.sessionStatus === 'TERMINATED' || assignment.terminationReason) {
      throw new BadRequestException('This exam session was terminated by a proctor due to security rules. Re-attempts are not allowed.');
    }

    const maxAttempts = exam?.maxAttempts ?? assignment.exam?.maxAttempts ?? 1;
    if ((assignment.attemptsUsed ?? 0) >= maxAttempts && (assignment.status === 'SUBMITTED' || assignment.status === 'GRADED')) {
      throw new BadRequestException(`Maximum allowed attempts (${maxAttempts}) reached for this exam.`);
    }

    const attemptsUsed = (assignment.attemptsUsed ?? 0) + 1;
    const status = attemptsUsed < maxAttempts ? 'ASSIGNED' : 'SUBMITTED';

    const updated = await this.prisma.examAssignment.update({
      where: { id: assignment.id },
      data: {
        status,
        sessionStatus: 'SUBMITTED',
        answers,
        submittedAt: new Date(),
        totalMarks: totalMarks ?? assignment.totalMarks ?? 100,
        attemptsUsed,
      },
    });

    return successResponse(updated);
  }

  async gradeAssignment(assignmentId: string, score: number, status?: string) {
    const assignment = await this.prisma.examAssignment.findUnique({
      where: { id: assignmentId },
      include: { exam: true },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment '${assignmentId}' not found`);
    }

    const updated = await this.prisma.examAssignment.update({
      where: { id: assignmentId },
      data: {
        score,
        status: (status as any) || 'GRADED',
      },
    });

    // Auto-issue certificate if passing conditions are met & exam settings enable it
    if (updated.status === 'GRADED' && updated.score !== null) {
      const exam = assignment.exam;
      if (exam && exam.certificateIssuance && updated.score >= exam.passingScore) {
        try {
          const jwt = require('jsonwebtoken');
          const systemToken = jwt.sign(
            { sub: 'system_exam_service', role: 'PLATFORM_ADMIN', tenantId: updated.tenantId },
            process.env.JWT_SECRET || 'xe-recruiters-jwt-secret-change-in-production-2024',
            { expiresIn: '5m', issuer: 'xe-recruiters' }
          );
          await this.certificateService.checkAndIssueCertificate(updated.id, systemToken);
        } catch (err: any) {
          this.logger.error(`Failed to auto-issue certificate: ${err.message}`);
        }
      }
    }

    return successResponse(updated);
  }

  async getAllAssignments(tenantId?: string, candidateId?: string) {
    const where: any = candidateId ? { candidateId } : {};
    if (tenantId) {
      where.OR = [
        { tenantId },
        { exam: { tenantId } },
      ];
    }

    const assignments = await this.prisma.examAssignment.findMany({
      where,
      include: {
        exam: {
          include: {
            sections: {
              include: {
                questions: true,
              },
            },
          },
        },
        incidents: {
          orderBy: { timestamp: 'desc' },
        },
        decisionLogs: {
          orderBy: { timestamp: 'desc' },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return successResponse(assignments);
  }

  async issueCertificate(assignmentId: string, candidateName?: string, issuingOrg?: string) {
    const assignment = await this.prisma.examAssignment.findUnique({
      where: { id: assignmentId },
      include: { exam: true },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment '${assignmentId}' not found`);
    }

    // Check if certificate already exists
    const existing = await this.prisma.certificate.findUnique({
      where: { assignmentId },
    });

    if (existing) {
      // If candidateName was passed, update the existing one
      if (candidateName && existing.candidateName !== candidateName) {
        const updated = await this.prisma.certificate.update({
          where: { assignmentId },
          data: { candidateName },
        });
        return successResponse(updated);
      }
      return successResponse(existing);
    }

    const signature = 'xe-' + crypto.createHash('sha256').update(assignmentId + Date.now()).digest('hex').substring(0, 20);

    const certificate = await this.prisma.certificate.create({
      data: {
        id: generateId(),
        tenantId: assignment.tenantId,
        assignmentId: assignment.id,
        candidateId: assignment.candidateId,
        candidateName: candidateName || 'Candidate',
        examId: assignment.examId,
        examTitle: assignment.exam.title,
        score: assignment.score ?? 0,
        totalMarks: assignment.totalMarks ?? 100,
        issuingOrg: issuingOrg || 'Xebia Global Academy',
        signature,
      },
    });

    return successResponse(certificate);
  }

  async getCertificates(tenantId: string, candidateId?: string) {
    const certificates = await this.prisma.certificate.findMany({
      where: {
        tenantId,
        ...(candidateId && { candidateId }),
      },
      orderBy: { issuedAt: 'desc' },
    });
    return successResponse(certificates);
  }

  async verifyCertificate(signature: string) {
    const certificate = await this.prisma.certificate.findFirst({
      where: {
        OR: [
          { signature },
          { id: signature.startsWith('xe-') ? undefined : signature }
        ].filter(Boolean) as any,
      },
    });

    if (!certificate) {
      throw new NotFoundException(`Certificate not found for verification hash: ${signature}`);
    }

    return successResponse(certificate);
  }

  async saveOnboardingLogs(assignmentId: string, onboardingLogs: any, candidateId?: string, examId?: string) {
    let assignment = null;

    // 1. Try finding by ID if valid 24-char hex string
    if (assignmentId && assignmentId !== 'undefined' && assignmentId !== 'null' && assignmentId.length === 24) {
      try {
        assignment = await this.prisma.examAssignment.findUnique({
          where: { id: assignmentId },
        });
      } catch (e) { }
    }

    // 2. If not found by ID, try finding by examId and candidateId
    if (!assignment && (examId || assignmentId) && candidateId) {
      const searchExamId = examId || assignmentId;
      try {
        assignment = await this.prisma.examAssignment.findFirst({
          where: { examId: searchExamId, candidateId },
        });
      } catch (e) { }
    }

    // 3. If assignment does not exist yet, auto-create assignment for candidate!
    if (!assignment && (examId || (assignmentId && assignmentId.length === 24)) && candidateId) {
      const targetExamId = examId || assignmentId;
      try {
        const exam = await this.prisma.exam.findUnique({ where: { id: targetExamId } });
        if (exam) {
          assignment = await this.prisma.examAssignment.create({
            data: {
              id: generateId(),
              examId: exam.id,
              tenantId: exam.tenantId,
              candidateId,
              status: 'ASSIGNED',
              onboardingLogs: JSON.stringify(onboardingLogs),
            },
          });
          return successResponse(assignment);
        }
      } catch (e) { }
    }

    if (!assignment) {
      this.logger.warn(`Save onboarding logs: assignment ${assignmentId} not found, returning fallback success.`);
      return successResponse({ id: assignmentId, onboardingLogs });
    }

    const updated = await this.prisma.examAssignment.update({
      where: { id: assignment.id },
      data: { onboardingLogs: JSON.stringify(onboardingLogs) },
    });
    return successResponse(updated);
  }

  async getIncidentsForAssignment(assignmentId: string) {
    if (!assignmentId || assignmentId === 'all') {
      try {
        const incidents = await this.prisma.incident.findMany({
          orderBy: { timestamp: 'desc' },
          take: 50,
        });
        return successResponse(incidents);
      } catch (e) {
        return successResponse([]);
      }
    }
    try {
      const incidents = await this.prisma.incident.findMany({
        where: {
          OR: [
            { assignmentId: assignmentId.length === 24 ? assignmentId : undefined },
            { assignmentId },
          ].filter(Boolean) as any,
        },
        orderBy: { timestamp: 'desc' },
      });
      return successResponse(incidents);
    } catch (e) {
      return successResponse([]);
    }
  }

  async getAllIncidents(tenantId: string) {
    try {
      const incidents = await this.prisma.incident.findMany({
        where: tenantId ? { assignment: { tenantId } } : undefined,
        include: { assignment: true },
        orderBy: { timestamp: 'desc' },
      });
      return successResponse(incidents);
    } catch (e) {
      return successResponse([]);
    }
  }

  async reviewIncident(
    incidentId: string,
    dto: { reviewerDecision: string; reviewerReason?: string; reviewerIdentity?: string },
  ) {
    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        reviewerDecision: dto.reviewerDecision,
        reviewerReason: dto.reviewerReason,
        reviewerIdentity: dto.reviewerIdentity,
      },
    });

    if (dto.reviewerDecision === 'TERMINATED') {
      await this.prisma.examAssignment.update({
        where: { id: updated.assignmentId },
        data: { status: 'SUBMITTED', sessionStatus: 'TERMINATED', submittedAt: new Date() },
      });
    }

    return successResponse(updated);
  }

  async getActiveProctoringSessions(examId: string) {
    const assignments = await this.prisma.examAssignment.findMany({
      where: { examId },
      include: {
        incidents: {
          orderBy: { timestamp: 'desc' }
        },
        decisionLogs: {
          orderBy: { timestamp: 'desc' }
        },
        exam: true,
      },
    });
    return successResponse(assignments);
  }

  async getProctorDetail(assignmentId: string) {
    let assignment = null;
    if (assignmentId && assignmentId.length === 24) {
      try {
        assignment = await this.prisma.examAssignment.findUnique({
          where: { id: assignmentId },
          include: { exam: true, incidents: { orderBy: { timestamp: 'desc' } }, decisionLogs: { orderBy: { timestamp: 'desc' } } },
        });
      } catch (e) { }
    }
    if (!assignment && assignmentId && assignmentId !== 'all') {
      try {
        assignment = await this.prisma.examAssignment.findFirst({
          where: { OR: [{ examId: assignmentId }, { candidateId: assignmentId }] },
          include: { exam: true, incidents: { orderBy: { timestamp: 'desc' } }, decisionLogs: { orderBy: { timestamp: 'desc' } } },
        });
      } catch (e) { }
    }
    if (!assignment) {
      return successResponse({
        id: assignmentId,
        candidateId: 'candidate_id',
        examId: 'exam_id',
        sessionStatus: 'ACTIVE',
        trustScore: 100,
        incidents: [],
        decisionLogs: [],
        proctorWarnings: '[]',
      });
    }
    return successResponse(assignment);
  }

  async warnAssignment(assignmentId: string, message: string, proctorId: string = 'Proctor Admin') {
    let assignment = null;
    if (assignmentId && assignmentId.length === 24) {
      try {
        assignment = await this.prisma.examAssignment.findUnique({ where: { id: assignmentId } });
      } catch (e) { }
    }
    if (!assignment && assignmentId && assignmentId !== 'all') {
      try {
        assignment = await this.prisma.examAssignment.findFirst({
          where: { OR: [{ examId: assignmentId }, { candidateId: assignmentId }] },
        });
      } catch (e) { }
    }

    // Auto-create assignment record if it doesn't exist yet
    if (!assignment) {
      let targetExam = null;
      if (assignmentId && assignmentId.length === 24) {
        try {
          targetExam = await this.prisma.exam.findUnique({ where: { id: assignmentId } });
        } catch (e) { }
      }
      if (!targetExam) {
        try {
          targetExam = await this.prisma.exam.findFirst();
        } catch (e) { }
      }

      if (targetExam) {
        const newId = (assignmentId && assignmentId.length === 24) ? assignmentId : generateId();
        try {
          assignment = await this.prisma.examAssignment.create({
            data: {
              id: newId,
              examId: targetExam.id,
              candidateId: 'candidate_id',
              tenantId: targetExam.tenantId,
              status: 'IN_PROGRESS',
              sessionStatus: 'ACTIVE',
              attemptsUsed: 1,
              totalMarks: targetExam.totalMarks || 100,
              assignedAt: new Date(),
            },
          });
        } catch (e) {
          try {
            assignment = await this.prisma.examAssignment.findFirst();
          } catch (err) { }
        }
      }
    }

    let existingWarnings: any[] = [];
    if (assignment?.proctorWarnings) {
      try {
        existingWarnings = JSON.parse(assignment.proctorWarnings);
      } catch (e) { }
    }

    const newWarning = {
      id: generateId(),
      message,
      timestamp: new Date().toISOString(),
      proctorId,
    };
    existingWarnings.push(newWarning);

    const targetAssignmentId = assignment?.id || assignmentId;

    if (assignment?.id) {
      try {
        await this.prisma.examAssignment.update({
          where: { id: assignment.id },
          data: {
            sessionStatus: 'WARNED',
            proctorWarnings: JSON.stringify(existingWarnings),
          },
        });

        await this.prisma.proctorDecisionLog.create({
          data: {
            id: generateId(),
            assignmentId: assignment.id,
            actionType: 'WARN',
            rationale: message,
            reviewerIdentity: proctorId,
          },
        });
      } catch (e) { }
    }

    return successResponse({
      id: targetAssignmentId,
      sessionStatus: 'WARNED',
      message,
      proctorWarnings: JSON.stringify(existingWarnings),
    });
  }

  async terminateAssignment(
    assignmentId: string,
    reason: string,
    note?: string,
    proctorId: string = 'Proctor Admin',
    candidateIdParam?: string,
    examIdParam?: string,
  ) {
    let assignment = null;
    if (assignmentId && assignmentId.length === 24) {
      try {
        assignment = await this.prisma.examAssignment.findUnique({
          where: { id: assignmentId },
          include: { exam: true },
        });
      } catch (e) { }
    }
    if (!assignment && (candidateIdParam || examIdParam || assignmentId)) {
      const searchExamId = examIdParam || (assignmentId !== 'all' ? assignmentId : undefined);
      try {
        assignment = await this.prisma.examAssignment.findFirst({
          where: {
            OR: [
              ...(candidateIdParam && searchExamId ? [{ candidateId: candidateIdParam, examId: searchExamId }] : []),
              ...(searchExamId ? [{ examId: searchExamId }] : []),
              ...(candidateIdParam ? [{ candidateId: candidateIdParam }] : []),
            ].filter(Boolean) as any,
          },
          include: { exam: true },
        });
      } catch (e) { }
    }

    // Resolve target exam if assignment is not found
    let targetExam = assignment?.exam;
    if (!targetExam) {
      const searchExamId = examIdParam || (assignmentId && assignmentId.length === 24 ? assignmentId : undefined);
      if (searchExamId) {
        try {
          targetExam = await this.prisma.exam.findUnique({ where: { id: searchExamId } });
        } catch (e) { }
      }
      if (!targetExam) {
        try {
          targetExam = await this.prisma.exam.findFirst();
        } catch (e) { }
      }
    }

    const maxAttempts = targetExam?.maxAttempts || 1;
    const effectiveTenantId = targetExam?.tenantId || 'tenant_acme_001';
    const effectiveExamId = targetExam?.id || examIdParam || assignmentId;
    const effectiveCandId = candidateIdParam || assignment?.candidateId || 'candidate_id';

    // Auto-create assignment record with correct tenantId & candidateId if it doesn't exist yet
    if (!assignment && targetExam) {
      const newId = (assignmentId && assignmentId.length === 24) ? assignmentId : generateId();
      try {
        assignment = await this.prisma.examAssignment.create({
          data: {
            id: newId,
            examId: effectiveExamId,
            candidateId: effectiveCandId,
            tenantId: effectiveTenantId,
            status: 'SUBMITTED',
            sessionStatus: 'TERMINATED',
            attemptsUsed: maxAttempts,
            terminationReason: reason,
            terminationNote: note,
            submittedAt: new Date(),
            totalMarks: targetExam.totalMarks || 100,
            assignedAt: new Date(),
          },
          include: { exam: true },
        });
      } catch (e) {
        try {
          assignment = await this.prisma.examAssignment.findFirst({ where: { examId: effectiveExamId, candidateId: effectiveCandId } });
        } catch (err) { }
      }
    }

    const targetAssignmentId = assignment?.id || assignmentId;

    if (assignment?.id) {
      try {
        await this.prisma.examAssignment.update({
          where: { id: assignment.id },
          data: {
            sessionStatus: 'TERMINATED',
            status: 'SUBMITTED',
            submittedAt: new Date(),
            terminationReason: reason,
            terminationNote: note,
            attemptsUsed: Math.max(assignment.attemptsUsed || 1, maxAttempts),
          },
        });

        // Also update all matching candidate assignments for this exam & candidate
        if (assignment.candidateId && assignment.examId) {
          try {
            await this.prisma.examAssignment.updateMany({
              where: {
                examId: assignment.examId,
                candidateId: assignment.candidateId,
              },
              data: {
                sessionStatus: 'TERMINATED',
                status: 'SUBMITTED',
                submittedAt: new Date(),
                terminationReason: reason,
                terminationNote: note,
                attemptsUsed: maxAttempts,
              },
            });
          } catch (err) { }
        }

        await this.prisma.proctorDecisionLog.create({
          data: {
            id: generateId(),
            assignmentId: assignment.id,
            actionType: 'TERMINATE',
            rationale: `Reason: ${reason}${note ? ` | Note: ${note}` : ''}`,
            reviewerIdentity: proctorId,
          },
        });
      } catch (e) { }
    }

    return successResponse({
      id: targetAssignmentId,
      sessionStatus: 'TERMINATED',
      status: 'SUBMITTED',
      reason,
      note,
    });
  }

  async reviewIncidentWithAudit(
    incidentId: string,
    dto: { reviewerDecision: string; reviewerReason?: string; reviewerIdentity?: string },
  ) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: { assignment: { include: { exam: true } } },
    });
    if (!incident) throw new NotFoundException(`Incident '${incidentId}' not found`);

    const updatedIncident = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        reviewerDecision: dto.reviewerDecision,
        reviewerReason: dto.reviewerReason || 'Reviewed by Proctor',
        reviewerIdentity: dto.reviewerIdentity || 'Proctor Admin',
        decidedAt: new Date(),
      },
    });

    // If DISMISSED, restore trust score by +15
    if (dto.reviewerDecision === 'DISMISS' || dto.reviewerDecision === 'DISMISSED') {
      const restoredScore = Math.min(100, (incident.assignment.trustScore || 0) + 15);
      await this.prisma.examAssignment.update({
        where: { id: incident.assignmentId },
        data: {
          trustScore: restoredScore,
          sessionStatus: restoredScore >= 70 ? 'ACTIVE' : 'FLAGGED',
        },
      });
    } else if (dto.reviewerDecision === 'TERMINATE' || dto.reviewerDecision === 'TERMINATED') {
      const maxAttempts = incident.assignment?.exam?.maxAttempts || 1;
      await this.prisma.examAssignment.update({
        where: { id: incident.assignmentId },
        data: {
          sessionStatus: 'TERMINATED',
          status: 'SUBMITTED',
          submittedAt: new Date(),
          terminationReason: dto.reviewerReason || 'Terminated via incident review',
          attemptsUsed: Math.max(incident.assignment.attemptsUsed || 1, maxAttempts),
        },
      });
    }

    await this.prisma.proctorDecisionLog.create({
      data: {
        id: generateId(),
        assignmentId: incident.assignmentId,
        incidentId,
        actionType: dto.reviewerDecision,
        rationale: dto.reviewerReason || `Incident decision: ${dto.reviewerDecision}`,
        reviewerIdentity: dto.reviewerIdentity || 'Proctor Admin',
      },
    });

    return successResponse(updatedIncident);
  }

  async updateProctoringConfig(examId: string, dto: any) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException(`Exam '${examId}' not found`);

    // Check if configuration is locked
    if (exam.proctoringSettingsLocked) {
      throw new BadRequestException('Proctoring configuration is locked because an assessment session has already started.');
    }

    const updated = await this.prisma.exam.update({
      where: { id: examId },
      data: {
        ...(dto.proctoringMode !== undefined && { proctoringMode: dto.proctoringMode }),
        ...(dto.proctoringFlags !== undefined && { proctoringFlags: dto.proctoringFlags }),
        ...(dto.recordingConfig !== undefined && { recordingConfig: dto.recordingConfig }),
        ...(dto.sensitivityNotifyLimit !== undefined && { sensitivityNotifyLimit: parseInt(dto.sensitivityNotifyLimit) }),
        ...(dto.sensitivityWarningLimit !== undefined && { sensitivityWarningLimit: parseInt(dto.sensitivityWarningLimit) }),
        ...(dto.sensitivityTerminationLimit !== undefined && { sensitivityTerminationLimit: parseInt(dto.sensitivityTerminationLimit) }),
        ...(dto.autoTerminateOnTrustLimit !== undefined && { autoTerminateOnTrustLimit: dto.autoTerminateOnTrustLimit === true || dto.autoTerminateOnTrustLimit === 'true' }),
        ...(dto.proctoringSettingsLocked !== undefined && { proctoringSettingsLocked: dto.proctoringSettingsLocked === true || dto.proctoringSettingsLocked === 'true' }),
      },
    });

    return successResponse(updated);
  }
}


