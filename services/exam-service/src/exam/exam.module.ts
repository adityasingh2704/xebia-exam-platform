import { Module } from '@nestjs/common';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { CertificateModule } from '../certificate/certificate.module';
import { ProctoringGateway } from './proctoring.gateway';

@Module({
  imports: [CertificateModule],
  controllers: [ExamController],
  providers: [ExamService, ProctoringGateway],
  exports: [ExamService],
})
export class ExamModule {}
