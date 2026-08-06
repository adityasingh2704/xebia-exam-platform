import { Controller, Get, Param, Res, Query, Headers, HttpStatus, Response } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CertificateService } from './certificate.service';

@ApiTags('certificates')
@Controller('exams/certificates')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Get('assignment/:assignmentId')
  @ApiOperation({ summary: 'Get certificate by assignment ID' })
  async getByAssignment(@Param('assignmentId') assignmentId: string) {
    return this.certificateService.getCertificateByAssignmentId(assignmentId);
  }

  @Get('assignment/:assignmentId/download')
  @ApiOperation({ summary: 'Download certificate PDF file by assignment ID' })
  async downloadByAssignment(@Param('assignmentId') assignmentId: string, @Res() res: any) {
    try {
      const cert = await this.certificateService.getCertificateByAssignmentId(assignmentId);
      if (!cert) {
        return res.status(HttpStatus.NOT_FOUND).json({
          success: false,
          message: 'Certificate not found for this assignment',
        });
      }
      const buffer = await this.certificateService.generatePdfBuffer(cert.id);
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=certificate-${cert.id}.pdf`,
        'Content-Length': buffer.length,
      });

      res.status(HttpStatus.OK).send(buffer);
    } catch (err) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Failed to generate PDF: ${err.message}`,
      });
    }
  }

  @Get('candidate/:candidateId')
  @ApiOperation({ summary: 'Get all certificates for a candidate' })
  async getByCandidate(@Param('candidateId') candidateId: string) {
    return this.certificateService.getCertificatesByCandidateId(candidateId);
  }

  @Get(':id/verify')
  @ApiOperation({ summary: 'Publicly verify a certificate validity and details' })
  async verify(@Param('id') id: string) {
    return this.certificateService.verifyCertificate(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download certificate PDF file' })
  async download(@Param('id') id: string, @Res() res: any) {
    try {
      const buffer = await this.certificateService.generatePdfBuffer(id);
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=certificate-${id}.pdf`,
        'Content-Length': buffer.length,
      });

      res.status(HttpStatus.OK).send(buffer);
    } catch (err) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Failed to generate PDF: ${err.message}`,
      });
    }
  }
}
