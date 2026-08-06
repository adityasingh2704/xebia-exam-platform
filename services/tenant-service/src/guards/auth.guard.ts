import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    const path = request.path || request.url;
    // Allow public endpoints
    const isPublic =
      path.includes('/health') ||
      path.includes('/login') ||
      path.includes('/register') ||
      path.includes('/password-reset') ||
      path.includes('/verify-token');

    if (isPublic) return true;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Token is missing');
    }

    try {
      const decoded: any = jwt.verify(
        token,
        process.env.JWT_SECRET || 'xe-recruiters-jwt-secret-change-in-production-2024',
      );
      request.user = decoded;

      // STRICT TENANT ISOLATION
      // Extract tenant ID from query parameters, path params, or request body
      const requestedTenantId =
        request.query.tenantId || request.params.tenantId || request.params.id || request.body.tenantId;

      if (requestedTenantId && decoded.role !== 'PLATFORM_ADMIN') {
        if (decoded.tenantId !== requestedTenantId) {
          throw new ForbiddenException('Access denied: Tenant isolation violation');
        }
      }

      // Enforce strict Role-Based Access Control (RBAC)
      if (path.includes('/tenants') && !path.includes('/branding') && !path.includes('/settings') && !path.includes('/audit-logs') && !path.includes('/smtp') && !path.includes('/security-policy') && !path.includes('/webhooks') && !path.includes('/api-keys')) {
        const isSelfTenantAccess = decoded.role === 'TENANT_ADMIN' && decoded.tenantId === requestedTenantId;
        if (decoded.role !== 'PLATFORM_ADMIN' && !isSelfTenantAccess) {
          throw new ForbiddenException('Access denied: Platform Administrator privileges required');
        }
      }

      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
