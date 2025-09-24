/**
 * Admin Token Manager for Fluxion Admin Frontend
 * Provides consistent token storage, retrieval, and validation for admin authentication
 */

export interface TokenData {
  value: string;
  timestamp: number;
  expiresAt?: number;
}

export class AdminTokenManager {
  private tokenKey: string;
  
  constructor(tokenKey: string = 'fluxion_admin_auth_token') {
    this.tokenKey = tokenKey;
  }

  /**
   * Get authentication token with robust fallback handling
   */
  getToken(): string | null {
    if (typeof window === 'undefined') {
      console.debug('🔍 AdminTokenManager - Server-side rendering, no token available');
      return null;
    }

    try {
      // Primary method: Try structured storage first
      const structuredToken = this.getStructuredToken();
      if (structuredToken) {
        console.debug('✅ AdminTokenManager - Token retrieved via structured storage:', {
          tokenLength: structuredToken.length,
          tokenPreview: structuredToken.substring(0, 25) + '...',
          source: 'structured'
        });
        return structuredToken;
      }

      // Fallback method: Try raw localStorage access
      const rawToken = localStorage.getItem(this.tokenKey);
      if (rawToken) {
        console.debug('⚠️ AdminTokenManager - Fallback to raw token retrieval:', {
          tokenLength: rawToken.length,
          tokenPreview: rawToken.substring(0, 25) + '...',
          source: 'raw'
        });
        
        // Validate that it's a reasonable token format
        if (this.isValidTokenFormat(rawToken)) {
          return rawToken;
        }
      }

      console.debug('❌ AdminTokenManager - No valid token found by any method');
      return null;
    } catch (error) {
      console.error('❌ AdminTokenManager - Error retrieving token:', error);
      return null;
    }
  }

  /**
   * Set authentication token with structured storage
   */
  setToken(token: string, expiresInMs?: number): boolean {
    if (typeof window === 'undefined') {
      console.error('🚫 AdminTokenManager - Cannot set token in server-side environment');
      return false;
    }

    if (!token || !this.isValidTokenFormat(token)) {
      console.error('❌ AdminTokenManager - Invalid token format provided');
      return false;
    }

    try {
      const tokenData: TokenData = {
        value: token,
        timestamp: Date.now(),
        expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined
      };

      const serialized = JSON.stringify(tokenData);
      localStorage.setItem(this.tokenKey, serialized);

      // Immediate verification
      const verification = this.getToken();
      const success = verification === token;

      console.debug('🔄 AdminTokenManager - Token storage result:', {
        success,
        tokenLength: token.length,
        hasExpiration: !!expiresInMs,
        verificationPassed: success
      });

      return success;
    } catch (error) {
      console.error('❌ AdminTokenManager - Error setting token:', error);
      return false;
    }
  }

  /**
   * Remove authentication token
   */
  removeToken(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      localStorage.removeItem(this.tokenKey);
      
      // Verify removal
      const verification = this.getToken();
      const success = verification === null;
      
      console.debug('🗑️ AdminTokenManager - Token removal result:', { success });
      return success;
    } catch (error) {
      console.error('❌ AdminTokenManager - Error removing token:', error);
      return false;
    }
  }

  /**
   * Check if admin is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const authenticated = !!token;
    console.debug('🔍 AdminTokenManager - Authentication check:', { authenticated });
    return authenticated;
  }

  /**
   * Get token with automatic expiry handling
   */
  private getStructuredToken(): string | null {
    try {
      const raw = localStorage.getItem(this.tokenKey);
      if (!raw) return null;

      // Try to parse as structured data
      const parsed: TokenData = JSON.parse(raw);
      
      // Check for expiration
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        console.debug('🕒 AdminTokenManager - Token expired, removing');
        this.removeToken();
        return null;
      }

      return parsed.value || null;
    } catch (error) {
      // If parsing fails, might be raw token string
      console.debug('🔄 AdminTokenManager - Structured parsing failed, checking raw format');
      return null;
    }
  }

  /**
   * Validate token format (basic JWT validation)
   */
  private isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    
    // Basic JWT format check (3 parts separated by dots)
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Check minimum length (reasonable JWT should be longer)
    if (token.length < 50) return false;
    
    return true;
  }

  /**
   * Decode JWT payload (for debugging)
   */
  decodeTokenPayload(): any | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch (error) {
      console.error('❌ AdminTokenManager - Error decoding token payload:', error);
      return null;
    }
  }
}

// Create and export singleton instance
export const adminTokenManager = new AdminTokenManager();

// Export convenience functions
export const getAdminToken = () => adminTokenManager.getToken();
export const setAdminToken = (token: string, expiresInMs?: number) => adminTokenManager.setToken(token, expiresInMs);
export const removeAdminToken = () => adminTokenManager.removeToken();
export const isAdminAuthenticated = () => adminTokenManager.isAuthenticated();
export const getAdminTokenPayload = () => adminTokenManager.decodeTokenPayload();