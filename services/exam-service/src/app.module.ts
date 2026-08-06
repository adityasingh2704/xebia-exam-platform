import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExamModule } from './exam/exam.module';
import { CodeExecutionModule } from './code-execution/code-execution.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { CertificateModule } from './certificate/certificate.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ExamModule,
    CodeExecutionModule,
    HealthModule,
    CertificateModule,
  ],
})
export class AppModule {}
