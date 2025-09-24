/**
 * Unified Token Manager for Fluxion Frontend Applications
 * Provides consistent token storage, retrieval, and validation across all API clients
 */

export interface TokenData {
  value: string;
  timestamp: number;
  expiresAt?: number;
}

export class TokenManager {
  private tokenKey: string;
  
  constructor(tokenKey: string) {
    this.tokenKey = tokenKey;
  }

  /**
   * Get authentication token with robust fallback handling
   */
  getToken(): string | null {
    if (typeof window === 'undefined') {
      console.debug('🔍 TokenManager - Server-side rendering, no token available');
      return null;
    }

    try {
      // Primary method: Try direct localStorage access first (simplest and most reliable)
      const directToken = localStorage.getItem(this.tokenKey);
      if (directToken && this.isValidTokenFormat(directToken)) {
        console.debug('✅ TokenManager - Token retrieved directly:', {
          tokenLength: directToken.length,
          tokenPreview: directToken.substring(0, 25) + '...',
          source: 'direct'
        });
        return directToken;
      }

      // Secondary method: Try structured storage
      const structuredToken = this.getStructuredToken();
      if (structuredToken) {
        console.debug('✅ TokenManager - Token retrieved via structured storage:', {
          tokenLength: structuredToken.length,
          tokenPreview: structuredToken.substring(0, 25) + '...',
          source: 'structured'
        });
        return structuredToken;
      }

      // Tertiary method: Try parsing raw token as JSON (backward compatibility)
      if (directToken) {
        try {
          const parsed = JSON.parse(directToken);
          if (parsed.value && this.isValidTokenFormat(parsed.value)) {
            console.debug('⚠️ TokenManager - Token extracted from JSON structure:', {
              tokenLength: parsed.value.length,
              tokenPreview: parsed.value.substring(0, 25) + '...',
              source: 'json-wrapped'
            });
            // Migrate to direct storage
            this.setToken(parsed.value);
            return parsed.value;
          }
        } catch {
          // Not JSON, already handled above
        }
      }

      // Additional fallback: Try alternative storage keys (migration support)
      const alternativeKeys = [
        'auth_token',
        'token', 
        'fluxion_token',
        'user_token',
        'authToken'
      ];
      
      for (const altKey of alternativeKeys) {
        try {
          const altToken = localStorage.getItem(altKey);
          if (altToken && this.isValidTokenFormat(altToken)) {
            console.debug('⚠️ TokenManager - Found token in alternative storage:', {
              key: altKey,
              tokenLength: altToken.length,
              tokenPreview: altToken.substring(0, 25) + '...',
              source: 'alternative'
            });
            
            // Migrate token to proper location
            this.setToken(altToken);
            localStorage.removeItem(altKey);
            return altToken;
          }
        } catch (error) {
          console.debug('🔍 TokenManager - Error checking alternative key:', altKey, error);
        }
      }

      console.debug('❌ TokenManager - No valid token found by any method');
      return null;
    } catch (error) {
      console.error('❌ TokenManager - Error retrieving token:', error);
      return null;
    }
  }

  /**
   * Set authentication token with structured storage
   */
  setToken(token: string, expiresInMs?: number): boolean {
    if (typeof window === 'undefined') {
      console.error('🚫 TokenManager - Cannot set token in server-side environment');
      return false;
    }

    if (!token || !this.isValidTokenFormat(token)) {
      console.error('❌ TokenManager - Invalid token format provided:', {
        hasToken: !!token,
        tokenType: typeof token,
        tokenLength: token?.length || 0,
        isValidFormat: token ? this.isValidTokenFormat(token) : false
      });
      return false;
    }

    try {
      // Store token directly as string for simplicity and compatibility
      // This ensures it works with all API clients
      localStorage.setItem(this.tokenKey, token);

      // Also store in structured format for backward compatibility
      const tokenData: TokenData = {
        value: token,
        timestamp: Date.now(),
        expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined
      };
      localStorage.setItem(`${this.tokenKey}_structured`, JSON.stringify(tokenData));

      // Immediate verification
      const verification = localStorage.getItem(this.tokenKey);
      const success = verification === token;

      console.debug('🔄 TokenManager - Token storage result:', {
        success,
        tokenLength: token.length,
        hasExpiration: !!expiresInMs,
        verificationPassed: success,
        directStorageWorks: !!verification,
        tokenPreview: token.substring(0, 25) + '...'
      });

      return success;
    } catch (error) {
      console.error('❌ TokenManager - Error setting token:', error);
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
      // Remove from all possible locations
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(`${this.tokenKey}_structured`);
      
      // Also remove any alternative keys that might have been used
      const alternativeKeys = [
        'auth_token',
        'token', 
        'fluxion_token',
        'user_token',
        'authToken'
      ];
      
      alternativeKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch {}
      });
      
      // Verify removal
      const verification = this.getToken();
      const success = verification === null;
      
      console.debug('🗑️ TokenManager - Token removal result:', { success });
      return success;
    } catch (error) {
      console.error('❌ TokenManager - Error removing token:', error);
      return false;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const authenticated = !!token;
    console.debug('🔍 TokenManager - Authentication check:', { authenticated });
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
        console.debug('🕒 TokenManager - Token expired, removing');
        this.removeToken();
        return null;
      }

      return parsed.value || null;
    } catch (error) {
      // If parsing fails, might be raw token string
      console.debug('🔄 TokenManager - Structured parsing failed, checking raw format');
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
}

// Create instances for different token types
export const userTokenManager = new TokenManager('fluxion_auth_token');
export const adminTokenManager = new TokenManager('fluxion_admin_auth_token');

// Export convenience functions for backward compatibility
export const getAuthToken = () => userTokenManager.getToken();
export const setAuthToken = (token: string, expiresInMs?: number) => userTokenManager.setToken(token, expiresInMs);
export const removeAuthToken = () => userTokenManager.removeToken();
export const isAuthenticated = () => userTokenManager.isAuthenticated();

export const getAdminToken = () => adminTokenManager.getToken();
export const setAdminToken = (token: string, expiresInMs?: number) => adminTokenManager.setToken(token, expiresInMs);
export const removeAdminToken = () => adminTokenManager.removeToken();
export const isAdminAuthenticated = () => adminTokenManager.isAuthenticated();