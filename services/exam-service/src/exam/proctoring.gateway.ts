import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class ProctoringGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ProctoringGateway.name);

  constructor(private readonly prisma: PrismaService) { }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @MessageBody() data: { assignmentId: string; role: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { assignmentId, role } = data;
    if (!assignmentId) return { event: 'error', data: 'Missing assignmentId' };

    await client.join(assignmentId);
    this.logger.log(`Socket ${client.id} joined room ${assignmentId} as ${role}`);

    if (role === 'candidate') {
      try {
        await this.prisma.examAssignment.updateMany({
          where: {
            OR: [
              { id: assignmentId.length === 24 ? assignmentId : undefined },
              { examId: assignmentId.length === 24 ? assignmentId : undefined },
            ].filter(Boolean) as any,
          },
          data: {
            sessionStatus: 'ACTIVE',
            status: 'IN_PROGRESS',
            startedAt: new Date(),
          },
        });
      } catch (e) { }
    }

    let assignment = null;
    if (assignmentId && assignmentId.length === 24) {
      try {
        assignment = await this.prisma.examAssignment.findUnique({
          where: { id: assignmentId },
        });
      } catch (e) { }
    }
    if (!assignment) {
      try {
        assignment = await this.prisma.examAssignment.findFirst({
          where: { examId: assignmentId },
        });
      } catch (e) { }
    }

    if (assignment) {
      await client.join(`exam-${assignment.examId}`);
      this.logger.log(`Socket ${client.id} joined exam room exam-${assignment.examId}`);
    }

    return { event: 'joined', data: { assignmentId, role } };
  }

  @SubscribeMessage('report-incident')
  async handleReportIncident(
    @MessageBody()
    data: {
      assignmentId: string;
      examId?: string;
      candidateName?: string;
      flagType: string;
      severity: string;
      confidenceScore: number;
      screenshot?: string;
    },
  ) {
    const { assignmentId, examId, candidateName, flagType, severity, confidenceScore, screenshot } = data;
    if (!assignmentId) return { success: false, error: 'Missing assignmentId' };

    let assignment = null;

    // 1. Try finding assignment by ID if valid 24-char ObjectId
    if (assignmentId && assignmentId.length === 24) {
      try {
        assignment = await this.prisma.examAssignment.findUnique({
          where: { id: assignmentId },
          include: { exam: true },
        });
      } catch (e) { }
    }

    // 2. Try finding assignment by examId / candidateId
    if (!assignment && (examId || assignmentId)) {
      const searchExamId = examId || assignmentId;
      try {
        assignment = await this.prisma.examAssignment.findFirst({
          where: {
            OR: [
              { examId: searchExamId },
              { candidateId: assignmentId },
            ],
          },
          include: { exam: true },
        });
      } catch (e) { }
    }

    // 3. Fallback: resolve target Exam and auto-create assignment record if missing
    if (!assignment) {
      const targetExamId = examId || (assignmentId.length === 24 ? assignmentId : undefined);
      let targetExam = null;
      if (targetExamId) {
        try {
          targetExam = await this.prisma.exam.findUnique({ where: { id: targetExamId } });
        } catch (e) { }
      }
      if (!targetExam) {
        try {
          targetExam = await this.prisma.exam.findFirst();
        } catch (e) { }
      }

      if (targetExam) {
        try {
          assignment = await this.prisma.examAssignment.create({
            data: {
              id: (assignmentId && assignmentId.length === 24) ? assignmentId : 'inst_' + Date.now(),
              examId: targetExam.id,
              candidateId: 'candidate_id',
              tenantId: targetExam.tenantId,
              status: 'IN_PROGRESS',
              sessionStatus: 'ACTIVE',
              attemptsUsed: 1,
              totalMarks: targetExam.totalMarks || 100,
              assignedAt: new Date(),
            },
            include: { exam: true },
          });
        } catch (e) {
          try {
            assignment = await this.prisma.examAssignment.findFirst();
          } catch (err) { }
        }
      }
    }

    const realAssignmentId = assignment ? assignment.id : assignmentId;
    const realExamId = assignment ? assignment.examId : (examId || assignmentId);
    const currentTrustScore = assignment ? assignment.trustScore : 100;

    // Save incident to DB
    let incident = null;
    try {
      incident = await this.prisma.incident.create({
        data: {
          assignmentId: realAssignmentId,
          flagType,
          severity,
          confidenceScore,
          screenshot,
          reviewerDecision: 'PENDING',
        },
      });
    } catch (e) {
      incident = { id: `inc_${Date.now()}`, timestamp: new Date() };
    }

    // Decrease trust score
    let decrement = 5;
    if (severity === 'MEDIUM') decrement = 15;
    if (severity === 'HIGH') decrement = 25;
    if (flagType === 'TAB_SWITCH') decrement = 15;

    const newTrustScore = Math.max(0, currentTrustScore - decrement);

    if (assignment) {
      try {
        await this.prisma.examAssignment.update({
          where: { id: assignment.id },
          data: {
            trustScore: newTrustScore,
            ...(newTrustScore < 70 ? { sessionStatus: 'FLAGGED' } : {}),
          },
        });
      } catch (e) { }
    }

    const payload = {
      incidentId: incident?.id || `inc_${Date.now()}`,
      assignmentId: realAssignmentId,
      originalAssignmentId: assignmentId,
      examId: realExamId,
      candidateName: candidateName || 'Candidate',
      flagType,
      severity,
      confidenceScore,
      screenshot,
      timestamp: incident?.timestamp ? new Date(incident.timestamp).toISOString() : new Date().toISOString(),
      trustScore: newTrustScore,
      candidateId: assignment?.candidateId || 'candidate_id',
    };

    // Broadcast update and alert proctor console
    this.server.to(`exam-${realExamId}`).emit('incident-flagged', payload);
    this.server.to(realAssignmentId).emit('incident-flagged', payload);
    this.server.to(assignmentId).emit('incident-flagged', payload);
    this.server.emit('incident-flagged', payload); // Broadcast globally to proctor console

    this.server.to(realAssignmentId).emit('trust-score-updated', { trustScore: newTrustScore });
    this.server.to(assignmentId).emit('trust-score-updated', { trustScore: newTrustScore });

    // Send AI alert message to Proctor Dashboard
    const proctorAlertPayload = {
      assignmentId: realAssignmentId,
      candidateName: candidateName || 'Candidate',
      candidateId: assignment?.candidateId || 'candidate_id',
      examId: realExamId,
      examTitle: assignment?.exam?.title || 'Proctored Exam',
      flagType,
      severity,
      trustScore: newTrustScore,
      message: `🚨 AI Proctor Alert: ${candidateName || 'Candidate'} flagged for suspicious activity (${flagType}). Trust score: ${newTrustScore}%.`,
      timestamp: new Date().toISOString(),
    };
    this.server.to(`exam-${realExamId}`).emit('ai-proctor-alert', proctorAlertPayload);
    this.server.to(realAssignmentId).emit('ai-proctor-alert', proctorAlertPayload);
    this.server.emit('ai-proctor-alert', proctorAlertPayload);

    this.logger.log(`Incident reported for assignment ${realAssignmentId}: ${flagType} (${severity})`);

    // Send gentle non-terminating warning to candidate to stay focused
    if (newTrustScore <= 60) {
      this.server.to(realAssignmentId).emit('receive-warning', {
        message: `Security Notice: AI proctor flagged suspicious activity (${flagType}). Please stay focused on your assessment.`,
      });
    }

    return { success: true, trustScore: newTrustScore };
  }

  @SubscribeMessage('candidate-video-frame')
  async handleCandidateVideoFrame(
    @MessageBody() data: { assignmentId: string; screenshot: string; candidateName?: string; examId?: string },
  ) {
    const { assignmentId, screenshot, candidateName, examId } = data;
    if (!assignmentId || !screenshot) return { success: false };

    let assignment = null;
    if (assignmentId && assignmentId.length === 24) {
      try {
        assignment = await this.prisma.examAssignment.findUnique({
          where: { id: assignmentId },
        });
      } catch (e) { }
    }

    if (!assignment && (examId || assignmentId)) {
      try {
        assignment = await this.prisma.examAssignment.findFirst({
          where: { examId: examId || assignmentId },
        });
      } catch (e) { }
    }

    const payload = {
      assignmentId: assignment ? assignment.id : assignmentId,
      candidateName: candidateName || 'Candidate',
      examId: assignment ? assignment.examId : examId,
      screenshot,
      timestamp: new Date().toISOString(),
    };

    if (assignment) {
      this.server.to(`exam-${assignment.examId}`).emit('candidate-video-frame', payload);
      this.server.to(assignment.id).emit('candidate-video-frame', payload);
    }
    this.server.to(assignmentId).emit('candidate-video-frame', payload);
    this.server.emit('candidate-video-frame', payload); // Broadcast globally for proctor board

    return { success: true };
  }

  @SubscribeMessage('candidate-screen-frame')
  async handleCandidateScreenFrame(
    @MessageBody() data: { assignmentId: string; screenScreenshot: string; candidateName?: string; examId?: string },
  ) {
    const { assignmentId, screenScreenshot, candidateName, examId } = data;
    if (!assignmentId || !screenScreenshot) return { success: false };

    let assignment = null;
    if (assignmentId && assignmentId.length === 24) {
      try {
        assignment = await this.prisma.examAssignment.findUnique({
          where: { id: assignmentId },
        });
      } catch (e) { }
    }

    if (!assignment && (examId || assignmentId)) {
      try {
        assignment = await this.prisma.examAssignment.findFirst({
          where: { examId: examId || assignmentId },
        });
      } catch (e) { }
    }

    const payload = {
      assignmentId: assignment ? assignment.id : assignmentId,
      candidateName: candidateName || 'Candidate',
      examId: assignment ? assignment.examId : examId,
      screenScreenshot,
      timestamp: new Date().toISOString(),
    };

    if (assignment) {
      this.server.to(`exam-${assignment.examId}`).emit('candidate-screen-frame', payload);
      this.server.to(assignment.id).emit('candidate-screen-frame', payload);
    }
    this.server.to(assignmentId).emit('candidate-screen-frame', payload);
    this.server.emit('candidate-screen-frame', payload); // Broadcast globally for proctor console

    return { success: true };
  }

  @SubscribeMessage('candidate-progress')
  async handleCandidateProgress(
    @MessageBody() data: { assignmentId: string; questionsAnswered: number; totalQuestions: number },
  ) {
    const { assignmentId, questionsAnswered, totalQuestions } = data;
    if (!assignmentId) return { success: false };

    const assignment = await this.prisma.examAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (assignment) {
      const payload = {
        assignmentId,
        questionsAnswered,
        totalQuestions,
      };
      this.server.to(`exam-${assignment.examId}`).emit('candidate-progress', payload);
      this.server.emit('candidate-progress', payload);
    }

    return { success: true };
  }

  @SubscribeMessage('send-warning')
  async handleSendWarning(
    @MessageBody() data: { assignmentId: string; message: string },
  ) {
    const { assignmentId, message } = data;

    let assignment = null;
    if (assignmentId && assignmentId.length === 24) {
      try {
        assignment = await this.prisma.examAssignment.findUnique({ where: { id: assignmentId } });
      } catch (e) { }
    }
    if (!assignment && assignmentId) {
      try {
        assignment = await this.prisma.examAssignment.findFirst({
          where: {
            OR: [
              { examId: assignmentId },
              { candidateId: assignmentId },
            ],
          },
        });
      } catch (e) { }
    }

    const targetId = assignment ? assignment.id : assignmentId;
    const examId = assignment ? assignment.examId : null;
    const candidateId = assignment ? assignment.candidateId : null;
    const payload = { message, timestamp: new Date().toISOString(), manual: true, assignmentId: targetId };

    // Emit warning to target assignment room, exam room, candidate room, and original assignment ID
    this.server.to(targetId).emit('receive-warning', payload);
    if (assignmentId && assignmentId !== targetId) {
      this.server.to(assignmentId).emit('receive-warning', payload);
    }
    if (examId) {
      this.server.to(examId).emit('receive-warning', payload);
      this.server.to(`exam-${examId}`).emit('receive-warning', payload);
    }
    if (candidateId) {
      this.server.to(candidateId).emit('receive-warning', payload);
    }
    this.server.emit('receive-warning', payload); // Global fallback so candidate definitely receives warning modal

    this.logger.log(`Proctor warning sent to candidate ${targetId}: ${message}`);
    return { success: true };
  }

  @SubscribeMessage('terminate-candidate')
  async handleTerminateCandidate(
    @MessageBody() data: { assignmentId: string; reason: string },
  ) {
    const { assignmentId, reason } = data;

    let assignment = null;
    if (assignmentId && assignmentId.length === 24) {
      try {
        assignment = await this.prisma.examAssignment.findUnique({
          where: { id: assignmentId },
          include: { exam: true },
        });
      } catch (e) { }
    }
    if (!assignment && assignmentId) {
      try {
        assignment = await this.prisma.examAssignment.findFirst({
          where: {
            OR: [
              { examId: assignmentId },
              { candidateId: assignmentId },
            ],
          },
          include: { exam: true },
        });
      } catch (e) { }
    }

    // Update DB if assignment was found
    if (assignment) {
      try {
        const maxAttempts = assignment.exam?.maxAttempts || 1;
        await this.prisma.examAssignment.update({
          where: { id: assignment.id },
          data: {
            status: 'SUBMITTED',
            sessionStatus: 'TERMINATED',
            submittedAt: new Date(),
            terminationReason: reason,
            attemptsUsed: Math.max(assignment.attemptsUsed || 1, maxAttempts),
          },
        });
      } catch (e) { }
    }

    const targetId = assignment ? assignment.id : assignmentId;
    const examId = assignment ? assignment.examId : null;
    const candidateId = assignment ? assignment.candidateId : null;
    const payload = { reason, timestamp: new Date().toISOString(), manual: true, assignmentId: targetId };

    // Broadcast force-terminate to all possible rooms the candidate socket joined
    this.server.to(targetId).emit('force-terminate', payload);
    if (assignmentId && assignmentId !== targetId) {
      this.server.to(assignmentId).emit('force-terminate', payload);
    }
    if (examId) {
      this.server.to(examId).emit('force-terminate', payload);
      this.server.to(`exam-${examId}`).emit('force-terminate', payload);
    }
    if (candidateId) {
      this.server.to(candidateId).emit('force-terminate', payload);
    }
    this.server.emit('force-terminate', payload); // Global fallback so candidate definitely receives termination signal

    this.logger.log(`Proctor manual termination sent to candidate ${targetId}`);
    return { success: true };
  }
}

