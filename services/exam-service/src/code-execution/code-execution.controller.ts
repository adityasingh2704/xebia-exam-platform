import {
  Controller, Get, Post, Body, Param, Query,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CodeExecutionService, SubmissionResult, Language } from './code-execution.service';

@ApiTags('code-execution')
@Controller('code-execution')
@ApiBearerAuth()
export class CodeExecutionController {
  constructor(private readonly codeExecutionService: CodeExecutionService) {}

  @Post('submit')
  @ApiOperation({ summary: 'Submit code for execution (synchronous — waits for result)' })
  async submit(
    @Body() dto: {
      source_code: string;
      language_id: number;
      stdin?: string;
      expected_output?: string;
      cpu_time_limit?: number;
      memory_limit?: number;
    },
  ) {
    const result = await this.codeExecutionService.submitAndWait(dto);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('submit-async')
  @ApiOperation({ summary: 'Submit code asynchronously (returns token for polling)' })
  async submitAsync(
    @Body() dto: {
      source_code: string;
      language_id: number;
      stdin?: string;
      expected_output?: string;
    },
  ) {
    const result = await this.codeExecutionService.submitAsync(dto);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('submissions/:token')
  @ApiOperation({ summary: 'Get submission result by token' })
  async getSubmission(@Param('token') token: string) {
    const result = await this.codeExecutionService.getSubmission(token);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('run-tests')
  @ApiOperation({ summary: 'Run code against multiple test cases' })
  async runTestCases(
    @Body() dto: {
      source_code: string;
      language_id: number;
      test_cases: Array<{ input: string; expected_output: string }>;
    },
  ) {
    const result = await this.codeExecutionService.runTestCases(
      dto.source_code,
      dto.language_id,
      dto.test_cases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expected_output,
      })),
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('batch')
  @ApiOperation({ summary: 'Submit batch of code executions' })
  async submitBatch(
    @Body() dto: {
      submissions: Array<{
        source_code: string;
        language_id: number;
        stdin?: string;
        expected_output?: string;
      }>;
    },
  ) {
    const results = await this.codeExecutionService.submitBatch(dto);
    return {
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('languages')
  @ApiOperation({ summary: 'Get all supported programming languages' })
  async getLanguages() {
    const languages = await this.codeExecutionService.getLanguages();
    return {
      success: true,
      data: languages,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('system-info')
  @ApiOperation({ summary: 'Get Judge0 system information' })
  async getSystemInfo() {
    const info = await this.codeExecutionService.getSystemInfo();
    return {
      success: true,
      data: info,
      timestamp: new Date().toISOString(),
    };
  }
}
