import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 60000,     // 1 minute
      limit: 20,       // 20 requests per minute
    }, {
      name: 'long',
      ttl: 3600000,   // 1 hour
      limit: 200,      // 200 requests per hour
    }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
