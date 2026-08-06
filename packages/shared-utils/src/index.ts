// ============================================
// Xe-Recruiters — Shared Utilities
// ============================================

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import type { JwtPayload } from '@xe-recruiters/shared-types';
import * as nodemailer from 'nodemailer';

// ── JWT Utilities ──────────────────────────────────

const DEFAULT_ACCESS_EXPIRY = '15m';
const DEFAULT_REFRESH_EXPIRY = '7d';

export function generateAccessToken(
  payload: JwtPayload,
  secret: string,
  expiresIn: any = DEFAULT_ACCESS_EXPIRY,
): string {
  return jwt.sign(payload, secret, { expiresIn, issuer: 'xe-recruiters' });
}

export function generateRefreshToken(
  payload: Pick<JwtPayload, 'sub' | 'tenantId'>,
  secret: string,
  expiresIn: any = DEFAULT_REFRESH_EXPIRY,
): string {
  return jwt.sign(payload, secret, { expiresIn, issuer: 'xe-recruiters' });
}

export function verifyToken<T = JwtPayload>(token: string, secret: string): T {
  return jwt.verify(token, secret, { issuer: 'xe-recruiters' }) as T;
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
}

// ── Password Utilities ────────────────────────────

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function validatePasswordStrength(
  password: string,
  minLength: number = 8,
  requireSpecialChar: boolean = true,
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit');
  }
  if (requireSpecialChar && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { isValid: errors.length === 0, errors };
}

// ── UUID Utilities ────────────────────────────────

export function generateId(): string {
  // Generate a 24-character hex string for MongoDB ObjectId compatibility
  return [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

// ── Slug Utilities ────────────────────────────────

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Date Utilities ────────────────────────────────

export function toUTC(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Date(d.toISOString());
}

export function formatDateTime(date: Date, timezone: string = 'UTC'): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(date);
}

// ── API Response Helpers ──────────────────────────

export function successResponse<T>(data: T) {
  return {
    success: true as const,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function errorResponse(code: string, message: string, details?: Record<string, unknown>) {
  return {
    success: false as const,
    error: { code, message, details },
    timestamp: new Date().toISOString(),
  };
}

// ── Pagination Helpers ────────────────────────────

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

// ── Event Helpers ─────────────────────────────────

export function createDomainEvent<T>(
  eventType: string,
  tenantId: string,
  actorId: string,
  payload: T,
) {
  return {
    eventId: generateId(),
    eventType,
    timestamp: new Date().toISOString(),
    tenantId,
    actorId,
    payload,
  };
}

// ── Export All ─────────────────────────────────────

export {
  jwt,
  bcrypt,
  uuidv4,
};
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass?: string;
  from: string;
}

export class EmailService {
  static createTransporter(config?: Partial<SmtpConfig>) {
    if (config?.host && config?.port && config?.user) {
      return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure ?? false,
        auth: {
          user: config.user,
          pass: config.pass || '',
        },
      });
    }

    return nodemailer.createTransport({
      host: process.env.DEFAULT_SMTP_HOST || 'smtp.sendgrid.net',
      port: parseInt(process.env.DEFAULT_SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.DEFAULT_SMTP_USER || '',
        pass: process.env.DEFAULT_SMTP_PASS || '',
      },
    });
  }

  static async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    tenantSmtp?: Partial<SmtpConfig>;
  }): Promise<boolean> {
    const transporter = this.createTransporter(options.tenantSmtp);
    const fromAddress = options.tenantSmtp?.from || process.env.DEFAULT_SMTP_FROM || 'no-reply@xe-recruiters.com';

    console.log(`[EMAIL DISPATCH] Dispatching email to: ${options.to}`);
    console.log(`[EMAIL DISPATCH] Subject: ${options.subject}`);
    console.log(`[EMAIL DISPATCH] From: ${fromAddress}`);
    console.log(`[EMAIL DISPATCH] Dynamic SMTP server used: ${options.tenantSmtp?.host || 'Platform Fallback'}`);

    try {
      await transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      console.log(`[EMAIL DISPATCH] Email successfully sent to ${options.to}`);
      return true;
    } catch (err: any) {
      console.error(`[EMAIL DISPATCH] Failed to send email to ${options.to}: ${err.message}`);
      return false;
    }
  }
}
