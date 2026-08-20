import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  generateId,
  successResponse,
} from '@xe-recruiters/shared-utils';
import type { JwtPayload, UserRole } from '@xe-recruiters/shared-types';
import { FirstLoginResetDto, RegisterDto } from './dto';

// Max failed login attempts before lockout
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;
const PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 24;

/**
 * AuthService handles all authentication logic:
 * - Login with credential verification (delegated to User Service via HTTP)
 * - JWT access & refresh token generation
 * - Session management (stored in Prisma)
 * - Token refresh flow
 * - Account lockout on failed attempts
 * - Password reset request & confirmation
 * - First-login password reset
 * - Logout & token revocation
 *
 * NOTE: In production, this service would call the User Service's internal API
 * to verify credentials. For Phase 1, we include a simplified user lookup
 * that can be replaced with an HTTP call to the User Service.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiration: string;
  private readonly jwtRefreshExpiration: string;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
  ) {
    this.jwtSecret = this.config.get('JWT_SECRET', 'dev-secret');
    this.jwtRefreshSecret = this.config.get('JWT_REFRESH_SECRET', 'dev-refresh-secret');
    this.jwtExpiration = this.config.get('JWT_EXPIRATION', '15m');
    this.jwtRefreshExpiration = this.config.get('JWT_REFRESH_EXPIRATION', '7d');
  }

  /**
   * Register a new user with password strength validation and tenant checks.
   */
  async register(dto: RegisterDto) {
    const { email, password, firstName, lastName, role, tenantSlug, tenantName } = dto;

    const tenantPrisma = this.getTenantPrismaClient();
    const userPrisma = this.getUserPrismaClient();

    try {
      let resolvedTenantId: string;
      const upperRole = role.toUpperCase();
      let minLength = 10;
      let requireSpecial = true;

      // 1. Resolve tenant parameters and dynamic security rules
      if (upperRole === 'PLATFORM_ADMIN') {
        resolvedTenantId = 'platform_admin';
      } else if (upperRole === 'TENANT_ADMIN') {
        if (!tenantName || !tenantSlug) {
          throw new BadRequestException('tenantName and tenantSlug are required for TENANT_ADMIN registration');
        }

        const existingTenant = await tenantPrisma.tenant.findUnique({
          where: { slug: tenantSlug },
        });
        if (existingTenant) {
          throw new BadRequestException('Tenant slug is already taken');
        }
      } else {
        if (!tenantSlug) {
          throw new BadRequestException('tenantSlug is required for registration');
        }

        const tenant = await tenantPrisma.tenant.findUnique({
          where: { slug: tenantSlug },
        });

        if (!tenant) {
          throw new BadRequestException('Tenant not found with slug: ' + tenantSlug);
        }

        resolvedTenantId = tenant.id;

        // Fetch security policy rules
        try {
          const policy = await tenantPrisma.securityPolicy.findUnique({
            where: { tenantId: resolvedTenantId },
          });
          if (policy) {
            minLength = policy.passwordMinLength ?? 10;
            requireSpecial = policy.requireSpecialChar ?? true;
          }
        } catch (policyErr) {
          this.logger.error(`Error loading security policy in register: ${policyErr.message}`);
        }
      }

      // 2. Validate password strength dynamically
      const validation = validatePasswordStrength(password, minLength, requireSpecial);
      if (!validation.isValid) {
        throw new BadRequestException({
          code: 'WEAK_PASSWORD',
          message: 'Password does not meet requirements',
          details: { errors: validation.errors },
        });
      }

      // 3. Create Tenant if Tenant Admin
      if (upperRole === 'TENANT_ADMIN') {
        const newTenant = await tenantPrisma.tenant.create({
          data: {
            id: generateId(),
            name: tenantName,
            slug: tenantSlug,
            status: 'ACTIVE',
            plan: 'enterprise',
            maxSeats: 500,
            usedSeats: 0,
          },
        });

        await tenantPrisma.tenantBranding.create({
          data: {
            id: generateId(),
            tenantId: newTenant.id,
            companyName: tenantName,
            primaryColor: '#6C1D5F',
            secondaryColor: '#FF6200',
          },
        });

        await tenantPrisma.tenantSettings.create({
          data: {
            id: generateId(),
            tenantId: newTenant.id,
          },
        });

        // Provision default SecurityPolicy for new tenant
        await tenantPrisma.securityPolicy.create({
          data: {
            id: generateId(),
            tenantId: newTenant.id,
            passwordMinLength: 10,
            requireSpecialChar: true,
            lockoutThreshold: 5,
            lockoutDuration: 15,
            firstLoginReset: true,
          },
        });

        resolvedTenantId = newTenant.id;
      } else {
        if (!tenantSlug) {
          throw new BadRequestException('tenantSlug is required for registration');
        }

        const tenant = await tenantPrisma.tenant.findUnique({
          where: { slug: tenantSlug },
        });

        if (!tenant) {
          throw new BadRequestException('Tenant not found with slug: ' + tenantSlug);
        }

        resolvedTenantId = tenant.id;
      }

      const existingUser = await userPrisma.user.findFirst({
        where: { email, tenantId: resolvedTenantId },
      });

      if (existingUser) {
        throw new BadRequestException('User with this email already exists in this tenant');
      }

      const hashedPassword = await hashPassword(password);

      const user = await userPrisma.user.create({
        data: {
          id: generateId(),
          tenantId: resolvedTenantId,
          email,
          passwordHash: hashedPassword,
          firstName,
          lastName,
          role: upperRole as any,
          isActive: true,
          requiresPasswordReset: false,
        },
      });

      this.logger.log(`Successfully registered user ${email} with role ${role} for tenant ${resolvedTenantId}`);

      return successResponse({
        message: 'Registration successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
        },
      });
    } finally {
      await userPrisma.$disconnect();
      await tenantPrisma.$disconnect();
    }
  }

  /**
   * Authenticate user and return access + refresh tokens.
   * Records login attempts and enforces account lockout.
   */
  async login(
    credentials: { email: string; password: string; tenantSlug?: string },
    ipAddress: string,
    userAgent: string,
  ) {
    const { email, password } = credentials;

    // Check account lockout
    const lockout = await this.prisma.accountLockout.findUnique({ where: { email } });
    if (lockout?.lockedUntil && lockout.lockedUntil > new Date()) {
      await this.recordLoginAttempt(email, lockout.tenantId, ipAddress, userAgent, false, 'ACCOUNT_LOCKED');
      throw new ForbiddenException({
        code: 'ACCOUNT_LOCKED',
        message: `Account is locked. Try again after ${lockout.lockedUntil.toISOString()}`,
        lockedUntil: lockout.lockedUntil,
      });
    }

    const user = await this.verifyCredentials(email, password);

    if (!user) {
      let resolvedTenantId: string | null = null;
      try {
        const userPrisma = this.getUserPrismaClient();
        const dbUser = await userPrisma.user.findFirst({ where: { email } });
        await userPrisma.$disconnect();
        if (dbUser) resolvedTenantId = dbUser.tenantId;
      } catch (err) {
        this.logger.error(`Error looking up user tenant for failed login: ${err.message}`);
      }

      await this.handleFailedLogin(email, resolvedTenantId, ipAddress, userAgent);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    // Reset lockout on successful login
    await this.prisma.accountLockout.deleteMany({ where: { email } });

    // Record successful login
    await this.recordLoginAttempt(email, user.tenantId, ipAddress, userAgent, true);

    // Generate tokens
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role as UserRole,
    };

    const accessToken = generateAccessToken(payload, this.jwtSecret, this.jwtExpiration);
    const refreshToken = generateRefreshToken(
      { sub: user.id, tenantId: user.tenantId },
      this.jwtRefreshSecret,
      this.jwtRefreshExpiration,
    );

    // Store session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days for refresh token

    await this.prisma.session.create({
      data: {
        id: generateId(),
        userId: user.id,
        tenantId: user.tenantId,
        refreshToken,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    this.logger.log(`User ${email} logged in successfully`);

    return successResponse({
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        requiresPasswordReset: user.requiresPasswordReset || false,
      },
    });
  }

  /**
   * Refresh the access token using a valid refresh token.
   */
  async refreshToken(refreshToken: string) {
    // Check if token is blacklisted
    const isBlacklisted = await this.redis.isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Verify the refresh token
    let decoded: { sub: string; tenantId: string };
    try {
      decoded = verifyToken(refreshToken, this.jwtRefreshSecret);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Find the session
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
    });

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    // Get user info (in production, call User Service)
    const user = await this.getUserById(decoded.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate new access token
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role as UserRole,
    };

    const newAccessToken = generateAccessToken(payload, this.jwtSecret, this.jwtExpiration);

    return successResponse({
      accessToken: newAccessToken,
      expiresIn: 900,
    });
  }

  /**
   * Logout user: revoke session and blacklist access token.
   */
  async logout(accessToken?: string, refreshToken?: string) {
    // Blacklist the access token
    if (accessToken) {
      try {
        const decoded = verifyToken(accessToken, this.jwtSecret);
        const ttl = (decoded.exp || 0) - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.redis.blacklistToken(accessToken, ttl);
        }
      } catch {
        // Token already expired, no need to blacklist
      }
    }

    // Revoke the refresh token session
    if (refreshToken) {
      await this.prisma.session.updateMany({
        where: { refreshToken },
        data: { isRevoked: true },
      });
    }

    return successResponse({ message: 'Logged out successfully' });
  }

  /**
   * Request a password reset email.
   * Always returns success to prevent email enumeration.
   */
  async requestPasswordReset(email: string) {
    // In production, look up user via User Service
    const user = await this.getUserByEmail(email);
    let activeToken: string | undefined = undefined;

    if (user) {
      const token = generateId();
      activeToken = token;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_TOKEN_EXPIRY_HOURS);

      await this.prisma.passwordReset.create({
        data: {
          id: generateId(),
          userId: user.id,
          tenantId: user.tenantId,
          token,
          expiresAt,
        },
      });

      // In production, publish event to Notification Service via Kafka
      this.logger.log(`Password reset requested for ${email}, token: ${token}`);
    }

    // Always return success to prevent email enumeration
    return successResponse({
      message: 'If the email exists, a password reset link has been sent',
      devToken: activeToken,
    });
  }

  /**
   * Confirm password reset with token.
   */
  async confirmPasswordReset(token: string, newPassword: string) {
    const resetRecord = await this.prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // Validate password strength
    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: 'Password does not meet requirements',
        details: { errors: validation.errors },
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password in User Service DB
    const userPrisma = this.getUserPrismaClient();
    try {
      await userPrisma.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash: hashedPassword,
          requiresPasswordReset: false,
        },
      });
    } finally {
      await userPrisma.$disconnect();
    }

    this.logger.log(`Password reset confirmed for user ${resetRecord.userId}`);

    // Mark reset token as used
    await this.prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    });

    // Revoke all sessions for this user
    await this.prisma.session.updateMany({
      where: { userId: resetRecord.userId },
      data: { isRevoked: true },
    });

    return successResponse({ message: 'Password has been reset successfully' });
  }

  /**
   * First login password reset (when user has temporary password).
   */
  async firstLoginReset(accessToken: string, dto: FirstLoginResetDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirmation do not match');
    }

    // Verify current token
    let decoded: JwtPayload;
    try {
      decoded = verifyToken(accessToken, this.jwtSecret);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    // Validate new password strength
    const validation = validatePasswordStrength(dto.newPassword);
    if (!validation.isValid) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: 'Password does not meet requirements',
        details: { errors: validation.errors },
      });
    }

    // Verify current password and update via User Service DB
    const userPrisma = this.getUserPrismaClient();
    try {
      const user = await userPrisma.user.findUnique({
        where: { id: decoded.sub }
      });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Check current password
      const isCurrentValid = await comparePassword(dto.currentPassword, user.passwordHash);
      if (!isCurrentValid) {
        throw new BadRequestException('Current password is incorrect');
      }

      const hashedPassword = await hashPassword(dto.newPassword);
      await userPrisma.user.update({
        where: { id: decoded.sub },
        data: {
          passwordHash: hashedPassword,
          requiresPasswordReset: false,
        },
      });
    } finally {
      await userPrisma.$disconnect();
    }

    this.logger.log(`First login password reset for user ${decoded.sub}`);

    return successResponse({ message: 'Password updated successfully' });
  }

  /**
   * Verify an access token and return the decoded payload.
   */
  async verifyAccessToken(token: string) {
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // Check blacklist
    const isBlacklisted = await this.redis.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    try {
      const decoded = verifyToken<JwtPayload>(token, this.jwtSecret);
      let firstName: string | undefined;
      let lastName: string | undefined;
      try {
        const userPrisma = this.getUserPrismaClient();
        const u = await userPrisma.user.findUnique({
          where: { id: decoded.sub },
          select: { firstName: true, lastName: true },
        });
        if (u) {
          firstName = u.firstName;
          lastName = u.lastName;
        }
      } catch {
        // fallback to decoded
      }

      return successResponse({
        valid: true,
        user: {
          id: decoded.sub,
          email: decoded.email,
          tenantId: decoded.tenantId,
          role: decoded.role,
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
        },
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  // ── Private Helpers ──────────────────────────────

  private async recordLoginAttempt(
    email: string,
    tenantId: string | null,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    failReason?: string,
  ) {
    await this.prisma.loginAttempt.create({
      data: {
        id: generateId(),
        email,
        tenantId,
        ipAddress,
        userAgent,
        success,
        failReason,
      },
    });
  }

  private async handleFailedLogin(
    email: string,
    tenantId: string | null,
    ipAddress: string,
    userAgent: string,
  ) {
    await this.recordLoginAttempt(email, tenantId, ipAddress, userAgent, false, 'INVALID_CREDENTIALS');

    // Fetch dynamic SecurityPolicy for the tenant (if exists)
    let threshold = 5;
    let durationMinutes = 15;

    if (tenantId) {
      try {
        const tenantPrisma = this.getTenantPrismaClient();
        const policy = await tenantPrisma.securityPolicy.findUnique({
          where: { tenantId }
        });
        await tenantPrisma.$disconnect();
        if (policy) {
          threshold = policy.lockoutThreshold ?? 5;
          durationMinutes = policy.lockoutDuration ?? 15;
        }
      } catch (err) {
        this.logger.error(`Error loading security policy for failed login: ${err.message}`);
      }
    }

    // Count failed attempts in the last 15 minutes
    const fifteenMinutesAgo = new Date();
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);

    const failedCount = await this.prisma.loginAttempt.count({
      where: {
        email,
        success: false,
        createdAt: { gte: fifteenMinutesAgo }
      }
    });

    // Lock account if failedCount is >= threshold
    if (failedCount >= threshold) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + durationMinutes);

      await this.prisma.accountLockout.upsert({
        where: { email },
        create: {
          id: generateId(),
          email,
          tenantId,
          failedCount,
          lockedUntil,
        },
        update: {
          failedCount,
          lockedUntil,
        }
      });

      this.logger.warn(`Account locked for ${email} until ${lockedUntil.toISOString()}`);
    }
  }

  /**
   * Verify user credentials.
   * In production, this calls the User Service via HTTP.
   * For Phase 1, uses demo users.
   */
  private getClientPath(serviceName: string, clientSubfolder: string): string {
    const path = require('path');
    const fs = require('fs');
    const possiblePaths = [
      path.resolve(process.cwd(), `services/${serviceName}/node_modules/@prisma/client/${clientSubfolder}`),
      path.resolve(process.cwd(), `node_modules/@prisma/client/${clientSubfolder}`),
      path.resolve(__dirname, `../../../../services/${serviceName}/node_modules/@prisma/client/${clientSubfolder}`),
      path.resolve(__dirname, `../../../${serviceName}/node_modules/@prisma/client/${clientSubfolder}`),
      path.resolve(__dirname, `../../${serviceName}/node_modules/@prisma/client/${clientSubfolder}`),
      path.resolve(__dirname, `../../../../node_modules/@prisma/client/${clientSubfolder}`),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    try {
      return require.resolve(`@prisma/client/${clientSubfolder}`);
    } catch {
      return `@prisma/client/${clientSubfolder}`;
    }
  }

  private getUserPrismaClient() {
    const userClientPath = this.getClientPath('user-service', 'user');
    const { PrismaClient } = require(userClientPath);
    const dbUrl =
      this.config.get('USER_DATABASE_URL') ||
      this.config.get('AUTH_DATABASE_URL') ||
      this.config.get('DATABASE_URL');
    return new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log: [],
    });
  }

  private getTenantPrismaClient() {
    const tenantClientPath = this.getClientPath('tenant-service', 'tenant');
    const { PrismaClient } = require(tenantClientPath);
    const dbUrl =
      this.config.get('TENANT_DATABASE_URL') ||
      this.config.get('AUTH_DATABASE_URL') ||
      this.config.get('DATABASE_URL');
    return new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log: [],
    });
  }

  private async verifyCredentials(
    email: string,
    password: string,
  ): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
    requiresPasswordReset: boolean;
  } | null> {
    try {
      const userPrisma = this.getUserPrismaClient();
      const users = await userPrisma.user.findMany({
        where: { email, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      await userPrisma.$disconnect();
      if (!users || users.length === 0) return null;
      const bcrypt = require('bcryptjs');
      for (const user of users) {
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (isValid) {
          return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenantId: user.tenantId,
            requiresPasswordReset: user.requiresPasswordReset,
          };
        }
      }
      return null;
    } catch (err) {
      this.logger.error(`verifyCredentials error: ${err.message}`);
      return null;
    }
  }

  private async getUserById(userId: string) {
    try {
      const userPrisma = this.getUserPrismaClient();
      const user = await userPrisma.user.findUnique({ where: { id: userId } });
      await userPrisma.$disconnect();
      return user;
    } catch {
      return null;
    }
  }

  private async getUserByEmail(email: string) {
    try {
      const userPrisma = this.getUserPrismaClient();
      const user = await userPrisma.user.findFirst({ where: { email } });
      await userPrisma.$disconnect();
      return user;
    } catch {
      return null;
    }
  }

  async unlockAccount(email: string) {
    await this.prisma.accountLockout.deleteMany({ where: { email } });
    this.logger.log(`Account unlocked for: ${email}`);
    return successResponse({ message: `Account unlocked for ${email}` });
  }
}
