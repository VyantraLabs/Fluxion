import { FindOptionsWhere, MoreThan, LessThan } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { InvoiceAccessToken } from '../entities/InvoiceAccessToken';
import { TenantContext } from '../../types/common';
import { FluxionError, ErrorCodes } from '../../types/common';

export interface CreateAccessTokenData {
  invoiceId: string;
  expiresInDays?: number;
  clientEmail?: string;
  clientName?: string;
  createdBy?: string;
  maxAccessCount?: number;
  permissions?: {
    canDownload?: boolean;
    canPay?: boolean;
    canViewHistory?: boolean;
  };
  customMessage?: string;
}

export class InvoiceAccessTokenRepository extends BaseRepository<InvoiceAccessToken> {
  constructor() {
    super(InvoiceAccessToken, 'InvoiceAccessToken');
  }

  /**
   * Create a new access token for invoice
   */
  async createAccessToken(tenantContext: TenantContext, data: CreateAccessTokenData): Promise<InvoiceAccessToken> {
    this.logger.info('Creating invoice access token', { 
      invoiceId: data.invoiceId,
      expiresInDays: data.expiresInDays || 30,
      tenantId: tenantContext.tenantId 
    });

    try {
      // Generate secure token
      const token = InvoiceAccessToken.generateSecureToken();
      
      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 30));

      const tokenData = InvoiceAccessToken.createAccessToken(
        data.invoiceId,
        data.expiresInDays || 30,
        data.clientEmail,
        data.clientName,
        data.createdBy
      );

      // Override with custom settings
      if (data.maxAccessCount) {
        tokenData.maxAccessCount = data.maxAccessCount;
      }

      if (data.permissions) {
        tokenData.metadata = {
          ...tokenData.metadata,
          permissions: { ...tokenData.metadata?.permissions, ...data.permissions }
        };
      }

      if (data.customMessage) {
        tokenData.metadata = {
          ...tokenData.metadata,
          customMessage: data.customMessage
        };
      }

      const accessToken = await super.create(tenantContext, tokenData);

      this.logger.info('Invoice access token created', { 
        tokenId: accessToken.id,
        invoiceId: data.invoiceId,
        expiresAt: accessToken.expiresAt,
        tenantId: tenantContext.tenantId 
      });

      return accessToken;
    } catch (error: any) {
      this.logger.error('Failed to create access token', { 
        error: error.message,
        invoiceId: data.invoiceId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Find access token by token string (no tenant context required for public access)
   */
  async findByToken(token: string): Promise<InvoiceAccessToken | null> {
    try {
      if (!InvoiceAccessToken.validateToken(token)) {
        throw new FluxionError(ErrorCodes.VALIDATION_ERROR, 'Invalid token format', 400);
      }

      const accessToken = await this.repository.findOne({
        where: { token },
        relations: ['invoice', 'invoice.network', 'invoice.token', 'invoice.organization'],
      });

      if (!accessToken) {
        return null;
      }

      // Check if token is still valid
      if (!accessToken.isValid) {
        this.logger.warn('Access attempt with invalid token', { 
          tokenId: accessToken.id,
          isExpired: accessToken.isExpired,
          accessCount: accessToken.accessCount,
          maxAccessCount: accessToken.maxAccessCount,
        });
        return null;
      }

      return accessToken;
    } catch (error: any) {
      this.logger.error('Failed to find access token', { 
        error: error.message,
        token: token.substring(0, 8) + '...' // Log only first 8 chars for security
      });
      throw error;
    }
  }

  /**
   * Record access to token
   */
  async recordAccess(
    token: string, 
    clientIp?: string, 
    userAgent?: string
  ): Promise<InvoiceAccessToken> {
    try {
      const accessToken = await this.findByToken(token);
      if (!accessToken) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Access token not found', 404);
      }

      if (!accessToken.isValid) {
        throw new FluxionError(ErrorCodes.FORBIDDEN, 'Access token is invalid or expired', 403);
      }

      // Record the access
      accessToken.recordAccess(clientIp, userAgent);
      const updatedToken = await this.repository.save(accessToken);

      this.logger.info('Access recorded for token', { 
        tokenId: accessToken.id,
        invoiceId: accessToken.invoiceId,
        accessCount: updatedToken.accessCount,
        clientIp,
      });

      return updatedToken;
    } catch (error: any) {
      this.logger.error('Failed to record access', { 
        error: error.message,
        token: token.substring(0, 8) + '...'
      });
      throw error;
    }
  }

  /**
   * Get all tokens for an invoice
   */
  async getInvoiceTokens(tenantContext: TenantContext, invoiceId: string): Promise<InvoiceAccessToken[]> {
    await this.setTenantContext(tenantContext);

    try {
      const tokens = await this.repository.find({
        where: { invoiceId },
        order: { createdAt: 'DESC' },
      });

      return tokens;
    } catch (error: any) {
      this.logger.error('Failed to get invoice tokens', { 
        error: error.message,
        invoiceId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Get active tokens for an invoice
   */
  async getActiveInvoiceTokens(tenantContext: TenantContext, invoiceId: string): Promise<InvoiceAccessToken[]> {
    await this.setTenantContext(tenantContext);

    try {
      const now = new Date();
      const tokens = await this.repository.find({
        where: {
          invoiceId,
          isActive: true,
          expiresAt: MoreThan(now),
        },
        order: { createdAt: 'DESC' },
      });

      // Filter by access count limit
      return tokens.filter(token => token.accessCount < token.maxAccessCount);
    } catch (error: any) {
      this.logger.error('Failed to get active invoice tokens', { 
        error: error.message,
        invoiceId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Deactivate access token
   */
  async deactivateToken(tenantContext: TenantContext, tokenId: string): Promise<void> {
    await this.setTenantContext(tenantContext);

    try {
      const token = await this.repository.findOne({
        where: { id: tokenId },
      });

      if (!token) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Access token not found', 404);
      }

      token.deactivate();
      await this.repository.save(token);

      this.logger.info('Access token deactivated', { 
        tokenId,
        tenantId: tenantContext.tenantId 
      });
    } catch (error: any) {
      this.logger.error('Failed to deactivate token', { 
        error: error.message,
        tokenId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Extend token expiry
   */
  async extendTokenExpiry(
    tenantContext: TenantContext, 
    tokenId: string, 
    additionalDays: number
  ): Promise<InvoiceAccessToken> {
    await this.setTenantContext(tenantContext);

    try {
      const token = await this.repository.findOne({
        where: { id: tokenId },
      });

      if (!token) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Access token not found', 404);
      }

      token.extendExpiry(additionalDays);
      const updatedToken = await this.repository.save(token);

      this.logger.info('Token expiry extended', { 
        tokenId,
        additionalDays,
        newExpiryDate: updatedToken.expiresAt,
        tenantId: tenantContext.tenantId 
      });

      return updatedToken;
    } catch (error: any) {
      this.logger.error('Failed to extend token expiry', { 
        error: error.message,
        tokenId,
        additionalDays,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const now = new Date();
      const result = await this.repository.delete({
        expiresAt: LessThan(now),
        isActive: false,
      });

      const deletedCount = result.affected || 0;
      
      this.logger.info('Expired tokens cleaned up', { 
        deletedCount,
      });

      return deletedCount;
    } catch (error: any) {
      this.logger.error('Failed to cleanup expired tokens', { 
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get token statistics for organization
   */
  async getTokenStats(tenantContext: TenantContext): Promise<{
    total: number;
    active: number;
    expired: number;
    totalAccesses: number;
    averageAccessesPerToken: number;
  }> {
    await this.setTenantContext(tenantContext);

    try {
      const tokens = await this.repository
        .createQueryBuilder('token')
        .leftJoin('token.invoice', 'invoice')
        .where('invoice.organization_id = :organizationId', { 
          organizationId: tenantContext.tenantId 
        })
        .getMany();

      const now = new Date();
      const total = tokens.length;
      const active = tokens.filter(t => t.isValid).length;
      const expired = tokens.filter(t => t.isExpired).length;
      const totalAccesses = tokens.reduce((sum, t) => sum + t.accessCount, 0);
      const averageAccessesPerToken = total > 0 ? totalAccesses / total : 0;

      return {
        total,
        active,
        expired,
        totalAccesses,
        averageAccessesPerToken,
      };
    } catch (error: any) {
      this.logger.error('Failed to get token stats', { 
        error: error.message,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Revoke all tokens for an invoice
   */
  async revokeInvoiceTokens(tenantContext: TenantContext, invoiceId: string): Promise<number> {
    await this.setTenantContext(tenantContext);

    try {
      const result = await this.repository.update(
        { invoiceId },
        { isActive: false }
      );

      const revokedCount = result.affected || 0;

      this.logger.info('Invoice tokens revoked', { 
        invoiceId,
        revokedCount,
        tenantId: tenantContext.tenantId 
      });

      return revokedCount;
    } catch (error: any) {
      this.logger.error('Failed to revoke invoice tokens', { 
        error: error.message,
        invoiceId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Update token permissions
   */
  async updateTokenPermissions(
    tenantContext: TenantContext,
    tokenId: string,
    permissions: {
      canDownload?: boolean;
      canPay?: boolean;
      canViewHistory?: boolean;
    }
  ): Promise<InvoiceAccessToken> {
    await this.setTenantContext(tenantContext);

    try {
      const token = await this.repository.findOne({
        where: { id: tokenId },
      });

      if (!token) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Access token not found', 404);
      }

      token.setPermissions(permissions);
      const updatedToken = await this.repository.save(token);

      this.logger.info('Token permissions updated', { 
        tokenId,
        permissions,
        tenantId: tenantContext.tenantId 
      });

      return updatedToken;
    } catch (error: any) {
      this.logger.error('Failed to update token permissions', { 
        error: error.message,
        tokenId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }
}