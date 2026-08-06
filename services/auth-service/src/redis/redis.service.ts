import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private connected = false;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD', '') || undefined,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 2) return null; // stop retrying after 2 attempts
        return Math.min(times * 500, 2000);
      },
      enableOfflineQueue: false,
    });

    this.client.on('connect', () => {
      this.connected = true;
      this.logger.log('🔴 Redis connected');
    });
    this.client.on('error', (err) => {
      this.connected = false;
      // Only log once to avoid spam
    });
    this.client.on('close', () => {
      this.connected = false;
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch {
      this.logger.warn('Redis unavailable — running without cache/blacklist (development mode)');
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {
      // ignore
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.connected) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.connected) return;
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch {
      // ignore
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.del(key);
    } catch {
      // ignore
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.connected) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  // Token blacklisting — no-ops when Redis is unavailable
  async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
    await this.set(`blacklist:${token}`, '1', ttlSeconds);
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    return this.exists(`blacklist:${token}`);
  }

  // Session caching
  async cacheSession(userId: string, sessionData: string, ttlSeconds: number): Promise<void> {
    await this.set(`session:${userId}`, sessionData, ttlSeconds);
  }

  async getSessionCache(userId: string): Promise<string | null> {
    return this.get(`session:${userId}`);
  }

  async clearSessionCache(userId: string): Promise<void> {
    await this.del(`session:${userId}`);
  }

  async isHealthy(): Promise<boolean> {
    if (!this.connected) return false;
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
