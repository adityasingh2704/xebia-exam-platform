import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExamService } from './exam.service';

@ApiTags('exams')
@Controller('exams')
@ApiBearerAuth()
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new exam' })
  async create(@Body() dto: any) {
    return this.examService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List exams with filtering' })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('tenantId') tenantId: string = 'seed-tenant-acme',
    @Query('candidateId') candidateId?: string,
  ) {
    return this.examService.findAll(tenantId, parseInt(page) || 1, parseInt(limit) || 20, status, search, candidateId);
  }

  @Get('assignments/all')
  @ApiOperation({ summary: 'Get all assignments for candidate or tenant' })
  async getAllAssignments(
    @Query('tenantId') tenantId?: string,
    @Query('candidateId') candidateId?: string
  ) {
    return this.examService.getAllAssignments(tenantId, candidateId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get exam by ID with sections' })
  async findById(@Param('id') id: string) {
    return this.examService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update exam' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.examService.update(id, dto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish exam (make available to candidates)' })
  async publish(@Param('id') id: string) {
    return this.examService.publish(id);
  }

  @Post(':id/sections')
  @ApiOperation({ summary: 'Add section to exam' })
  async addSection(@Param('id') id: string, @Body() dto: any) {
    return this.examService.addSection(id, dto);
  }

  @Put(':id/sections/:sectionId')
  @ApiOperation({ summary: 'Update exam section' })
  async updateSection(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: any,
  ) {
    return this.examService.updateSection(sectionId, dto);
  }

  @Post(':id/sections/:sectionId/questions')
  @ApiOperation({ summary: 'Add questions to section' })
  async addQuestionsToSection(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: { questionIds: string[] },
  ) {
    return this.examService.addQuestionsToSection(sectionId, dto.questionIds);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign candidates to exam' })
  async assignCandidates(@Param('id') id: string, @Body() dto: any) {
    return this.examService.assignCandidates(id, dto);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit exam attempt answers' })
  async submitExam(
    @Param('id') id: string,
    @Body() dto: { candidateId: string; answers: string; totalMarks?: number }
  ) {
    return this.examService.submitExam(id, dto.candidateId, dto.answers, dto.totalMarks);
  }

  @Post('assignments/:assignmentId/grade')
  @ApiOperation({ summary: 'Grade exam assignment response' })
  async gradeAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: { score: number; status?: string }
  ) {
    return this.examService.gradeAssignment(assignmentId, dto.score, dto.status);
  }

  @Put('assignments/:assignmentId')
  @ApiOperation({ summary: 'Update candidate exam assignment accommodations' })
  async updateAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: { timeMultiplier?: number; extraTimeMinutes?: number }
  ) {
    return this.examService.updateAssignment(assignmentId, dto);
  }

  @Get(':id/assignments')
  @ApiOperation({ summary: 'Get exam assignments' })
  async getAssignments(@Param('id') id: string) {
    return this.examService.getAssignments(id);
  }

  @Post('assignments/:assignmentId/issue-certificate')
  @ApiOperation({ summary: 'Issue certificate for completed exam' })
  async issueCertificate(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: { candidateName?: string; issuingOrg?: string }
  ) {
    return this.examService.issueCertificate(assignmentId, dto.candidateName, dto.issuingOrg);
  }

  @Get('certificates/my')
  @ApiOperation({ summary: 'Get current candidate certificates' })
  async getMyCertificates(
    @Query('tenantId') tenantId: string,
    @Query('candidateId') candidateId: string
  ) {
    return this.examService.getCertificates(tenantId, candidateId);
  }

  @Get('certificates/all')
  @ApiOperation({ summary: 'Get all certificates for a tenant' })
  async getAllCertificates(@Query('tenantId') tenantId: string) {
    return this.examService.getCertificates(tenantId);
  }

  @Get('certificates/verify/:hash')
  @ApiOperation({ summary: 'Publicly verify a certificate hash' })
  async verifyCertificate(@Param('hash') hash: string) {
    return this.examService.verifyCertificate(hash);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive exam' })
  async archive(@Param('id') id: string) {
    return this.examService.archive(id);
  }

  @Post('assignments/:assignmentId/onboarding')
  @ApiOperation({ summary: 'Save candidate onboarding logs' })
  async saveOnboardingLogs(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: { onboardingLogs: any; candidateId?: string; examId?: string }
  ) {
    return this.examService.saveOnboardingLogs(assignmentId, dto.onboardingLogs, dto.candidateId, dto.examId);
  }

  @Get('assignments/:assignmentId/incidents')
  @ApiOperation({ summary: 'Get proctoring incidents for assignment' })
  async getIncidentsForAssignment(@Param('assignmentId') assignmentId: string) {
    return this.examService.getIncidentsForAssignment(assignmentId);
  }

  @Get('incidents/all')
  @ApiOperation({ summary: 'Get all proctoring incidents' })
  async getAllIncidents(@Query('tenantId') tenantId: string) {
    return this.examService.getAllIncidents(tenantId);
  }

  @Put('incidents/:incidentId/review')
  @ApiOperation({ summary: 'Review proctoring incident' })
  async reviewIncident(
    @Param('incidentId') incidentId: string,
    @Body() dto: { reviewerDecision: string; reviewerReason?: string; reviewerIdentity?: string }
  ) {
    return this.examService.reviewIncident(incidentId, dto);
  }

  @Get(':id/proctoring/sessions')
  @ApiOperation({ summary: 'Get active proctoring sessions for exam' })
  async getActiveProctoringSessions(@Param('id') id: string) {
    return this.examService.getActiveProctoringSessions(id);
  }

  @Get('assignments/:assignmentId/proctor-detail')
  @ApiOperation({ summary: 'Get detailed candidate proctoring session view' })
  async getProctorDetail(@Param('assignmentId') assignmentId: string) {
    return this.examService.getProctorDetail(assignmentId);
  }

  @Post('assignments/:assignmentId/warn')
  @ApiOperation({ summary: 'Send text warning to candidate session' })
  async warnAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: { message: string; proctorId?: string }
  ) {
    return this.examService.warnAssignment(assignmentId, dto.message, dto.proctorId);
  }

  @Post('assignments/:assignmentId/terminate')
  @ApiOperation({ summary: 'Terminate candidate session with mandatory reason' })
  async terminateAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: { reason: string; note?: string; proctorId?: string; candidateId?: string; examId?: string }
  ) {
    return this.examService.terminateAssignment(assignmentId, dto.reason, dto.note, dto.proctorId, dto.candidateId, dto.examId);
  }

  @Post('incidents/:incidentId/decision')
  @ApiOperation({ summary: 'Process proctor decision for incident with audit log' })
  async reviewIncidentWithAudit(
    @Param('incidentId') incidentId: string,
    @Body() dto: { reviewerDecision: string; reviewerReason?: string; reviewerIdentity?: string }
  ) {
    return this.examService.reviewIncidentWithAudit(incidentId, dto);
  }

  @Put(':id/proctoring-config')
  @ApiOperation({ summary: 'Update proctoring configuration settings (locks when started)' })
  async updateProctoringConfig(@Param('id') id: string, @Body() dto: any) {
    return this.examService.updateProctoringConfig(id, dto);
  }
}

