import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateId, successResponse } from '@xe-recruiters/shared-utils';
import * as crypto from 'crypto';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(private prisma: PrismaService) {}

  private getSecretKey(): string {
    return process.env.JWT_SECRET || 'xe-recruiters-jwt-secret-change-in-production-2024';
  }

  // Generates cryptographic tamper-evident signature
  generateSignature(data: {
    id: string;
    candidateName: string;
    examTitle: string;
    score: number;
    totalMarks: number;
    issuedAt: string;
  }): string {
    const serialized = `${data.id}|${data.candidateName}|${data.examTitle}|${data.score}|${data.totalMarks}|${data.issuedAt}`;
    return crypto
      .createHmac('sha256', this.getSecretKey())
      .update(serialized)
      .digest('hex');
  }

  // Verification helper
  async verifyCertificate(id: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { id },
    });

    if (!certificate) {
      throw new NotFoundException(`Certificate with ID '${id}' not found`);
    }

    const calculatedSig = this.generateSignature({
      id: certificate.id,
      candidateName: certificate.candidateName,
      examTitle: certificate.examTitle,
      score: certificate.score,
      totalMarks: certificate.totalMarks,
      issuedAt: certificate.issuedAt.toISOString(),
    });

    const isAuthentic = calculatedSig === certificate.signature;

    return successResponse({
      id: certificate.id,
      candidateName: certificate.candidateName,
      examTitle: certificate.examTitle,
      score: certificate.score,
      totalMarks: certificate.totalMarks,
      issuedAt: certificate.issuedAt,
      issuingOrg: certificate.issuingOrg,
      isAuthentic,
    });
  }

  // Fetch candidate name from user-service
  private async getCandidateName(candidateId: string, token?: string): Promise<string> {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      }
      const response = await fetch(`http://localhost:3003/api/v1/users/${candidateId}`, { headers });
      if (response.ok) {
        const body = await response.json();
        const user = body.data || body;
        if (user && user.firstName) {
          return `${user.firstName} ${user.lastName || ''}`.trim();
        }
      }
    } catch (err) {
      this.logger.warn(`Could not fetch candidate name for ID ${candidateId}: ${err.message}`);
    }
    return `Candidate [ID: ${candidateId.slice(-6)}]`;
  }

  // Fetch issuing organization name from tenant-service
  private async getIssuingOrg(tenantId: string, token?: string): Promise<string> {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      }
      const response = await fetch(`http://localhost:3002/api/v1/tenants/${tenantId}`, { headers });
      if (response.ok) {
        const body = await response.json();
        const tenant = body.data || body;
        if (tenant) {
          return tenant.branding?.companyName || tenant.name || 'Xe-Recruits';
        }
      }
    } catch (err) {
      this.logger.warn(`Could not fetch tenant name for ID ${tenantId}: ${err.message}`);
    }
    return 'Xe-Recruits';
  }

  // Checks eligibility and generates a certificate if appropriate
  async checkAndIssueCertificate(assignmentId: string, token?: string) {
    const assignment = await this.prisma.examAssignment.findUnique({
      where: { id: assignmentId },
      include: { exam: true },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment '${assignmentId}' not found`);
    }

    const exam = assignment.exam;
    if (!exam.certificateIssuance) {
      this.logger.debug(`Certificate issuance is disabled for exam '${exam.title}'`);
      return null;
    }

    if (assignment.score === null || assignment.score === undefined) {
      this.logger.debug(`Assignment '${assignmentId}' has not been scored/graded yet`);
      return null;
    }

    // Check pass criteria
    if (assignment.score < exam.passingScore) {
      this.logger.debug(`Candidate did not meet passing score (${assignment.score} < ${exam.passingScore})`);
      return null;
    }

    // Check if certificate already exists
    const existing = await this.prisma.certificate.findUnique({
      where: { assignmentId },
    });

    if (existing) {
      return existing;
    }

    // Generate new certificate
    const certId = generateId();
    const candidateName = await this.getCandidateName(assignment.candidateId, token);
    const issuingOrg = await this.getIssuingOrg(assignment.tenantId, token);
    const issuedAt = new Date();

    const signature = this.generateSignature({
      id: certId,
      candidateName,
      examTitle: exam.title,
      score: assignment.score,
      totalMarks: exam.totalMarks,
      issuedAt: issuedAt.toISOString(),
    });

    const certificate = await this.prisma.certificate.create({
      data: {
        id: certId,
        tenantId: assignment.tenantId,
        assignmentId,
        candidateId: assignment.candidateId,
        candidateName,
        examId: exam.id,
        examTitle: exam.title,
        score: assignment.score,
        totalMarks: exam.totalMarks,
        issuedAt,
        issuingOrg,
        signature,
      },
    });

    this.logger.log(`Generated certificate ${certId} for candidate ${candidateName} on exam '${exam.title}'`);
    return certificate;
  }

  async getCertificateById(id: string) {
    const cert = await this.prisma.certificate.findUnique({ where: { id } });
    if (!cert) throw new NotFoundException(`Certificate '${id}' not found`);
    return cert;
  }

  async getCertificateByAssignmentId(assignmentId: string) {
    return this.prisma.certificate.findUnique({ where: { assignmentId } });
  }

  async getCertificatesByCandidateId(candidateId: string) {
    return this.prisma.certificate.findMany({
      where: { candidateId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  // Generates the PDF binary buffer dynamically on the fly
  async generatePdfBuffer(id: string): Promise<Buffer> {
    const cert = await this.getCertificateById(id);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        layout: 'landscape',
        size: 'A4',
        margin: 0,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const width = 841.89; // A4 landscape width
      const height = 595.28; // A4 landscape height

      // ── Background color (Pure White) ──
      doc.rect(0, 0, width, height).fill('#FFFFFF');

      // ── Right Decorative Waves (Gold & Blue) ──
      // Gold Wave
      doc.moveTo(width - 320, 0)
         .bezierCurveTo(width - 70, 150, width - 260, 420, width - 80, height)
         .lineTo(width, height)
         .lineTo(width, 0)
         .closePath()
         .fill('#FFCA58');

      // Blue Wave
      doc.moveTo(width - 210, 0)
         .bezierCurveTo(width + 20, 150, width - 150, 420, width - 240, height)
         .lineTo(width, height)
         .lineTo(width, 0)
         .closePath()
         .fill('#0A346C');

      // ── Gold Seal (Bottom-Right, overlaying waves) ──
      const cx = width - 120;
      const cy = height - 120;

      // Linear gradients for golden metal look
      const goldGrad = doc.linearGradient(cx - 45, cy - 45, cx + 45, cy + 45);
      goldGrad.stop(0, '#FFF9C4')
              .stop(0.5, '#FFCA58')
              .stop(1, '#D4AF37');

      const goldGradInner = doc.linearGradient(cx + 45, cy + 45, cx - 45, cy - 45);
      goldGradInner.stop(0, '#FFF9C4')
                   .stop(0.5, '#FFD54F')
                   .stop(1, '#B8860B');

      // Draw Gold Badge Base
      doc.circle(cx, cy, 45).fill(goldGrad);
      doc.circle(cx, cy, 40).lineWidth(1).stroke('#FFF9C4'); // Inner concentric line
      doc.circle(cx, cy, 30).fill(goldGradInner);
      doc.circle(cx, cy, 14).lineWidth(2).stroke('#FFF9C4');

      // Stamp Text
      doc.fillColor('#5C4033')
         .font('Helvetica-Bold')
         .fontSize(7)
         .text('XE-HQ', cx - 20, cy - 8, { align: 'center', width: 40 })
         .text('VERIFIED', cx - 20, cy + 2, { align: 'center', width: 40 });

      // ── Corner L-Accents ──
      // Top-Left L-Border
      doc.moveTo(40, 40)
         .lineTo(40 + 350, 40)
         .moveTo(40, 40)
         .lineTo(40, 40 + 120)
         .lineWidth(2)
         .stroke('#2C3E50');

      // Bottom-Left L-Border
      doc.moveTo(40, height - 40 - 120)
         .lineTo(40, height - 40)
         .lineTo(40 + 300, height - 40)
         .lineWidth(2)
         .stroke('#2C3E50');

      // ── Main Typography Content ──

      // Header: CERTIFICATE OF ACHIEVEMENT
      doc.fillColor('#0A346C')
         .font('Helvetica-Bold')
         .fontSize(44)
         .text('CERTIFICATE', 90, 90, { lineGap: 2 });

      doc.fillColor('#7F8C8D')
         .font('Helvetica-Bold')
         .fontSize(11)
         .text('OF ACHIEVEMENT', 94, 148, { characterSpacing: 3 });

      // Candidate Name (Serif Italic matching the elegant cursive)
      doc.fillColor('#2C3E50')
         .font('Times-Italic')
         .fontSize(42)
         .text(cert.candidateName, 90, 205);

      // Description text block
      const percentage = ((cert.score / cert.totalMarks) * 100).toFixed(1);
      doc.fillColor('#7F8C8D')
         .font('Times-Roman')
         .fontSize(11)
         .text(
           `For successfully meeting all the criteria and passing the professional assessment examination for ${cert.examTitle} with an outstanding score of ${cert.score} / ${cert.totalMarks} (${percentage}%). Issued by ${cert.issuingOrg} and recorded securely.`,
           90,
           265,
           { width: 420, lineGap: 5 }
         );

      // ── Bottom Meta Row (Date, Signature, verification info) ──
      const rowY = 390;

      // Date Column
      doc.fillColor('#0A346C')
         .font('Helvetica-Bold')
         .fontSize(10)
         .text('DATE', 90, rowY);

      const dateStr = cert.issuedAt.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      });
      doc.fillColor('#2C3E50')
         .font('Courier-Bold')
         .fontSize(12)
         .text(dateStr, 90, rowY + 20);

      // Signature Column
      doc.fillColor('#0A346C')
         .font('Helvetica-Bold')
         .fontSize(10)
         .text('SIGNATURE', 260, rowY);

      // Draw simulated signature curve
      doc.moveTo(260, rowY + 28)
         .quadraticCurveTo(275, rowY + 15, 285, rowY + 30)
         .quadraticCurveTo(310, rowY + 20, 335, rowY + 25)
         .lineWidth(1.5)
         .stroke('#555555');

      // Verification QR Metadata text (Mirroring QR code placement)
      doc.fillColor('#95A5A6')
         .font('Courier')
         .fontSize(8)
         .text(`VERIFICATION ID: ${cert.id}`, 90, height - 50)
         .text(`VERIFY PORTAL: http://localhost:3000/verify/${cert.id}`, 90, height - 38);

      doc.end();
    });
  }
}
