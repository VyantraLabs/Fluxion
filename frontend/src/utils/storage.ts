// Local storage utilities with error handling and type safety

export interface StorageItem<T> {
  value: T;
  timestamp: number;
  expiresAt?: number;
}

class SafeStorage {
  private isAvailable: boolean;

  constructor() {
    this.isAvailable = this.checkAvailability();
  }

  private checkAvailability(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  // Get item with optional expiration check
  get<T>(key: string): T | null {
    if (!this.isAvailable) {
      console.error('🚫 SafeStorage not available for key:', key);
      return null;
    }

    try {
      const item = localStorage.getItem(key);
      console.debug('🔍 SafeStorage getting item:', {
        key,
        exists: !!item,
        length: item?.length || 0,
        preview: item ? item.substring(0, 50) + '...' : null
      });
      
      if (!item) {
        console.debug('📭 SafeStorage item not found:', key);
        return null;
      }

      let parsed: StorageItem<T>;
      try {
        parsed = JSON.parse(item);
        console.debug('📦 SafeStorage parsed item:', {
          key,
          hasValue: 'value' in parsed,
          hasTimestamp: 'timestamp' in parsed,
          hasExpiration: 'expiresAt' in parsed,
          valueType: typeof parsed.value,
          structure: Object.keys(parsed)
        });
      } catch (parseError) {
        console.error('❌ SafeStorage JSON parse error for key:', key, parseError);
        console.debug('Raw data that failed to parse:', item);
        return null;
      }
      
      // Check if item has expired
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        console.debug('🕒 SafeStorage item expired, removing:', {
          key,
          expiresAt: new Date(parsed.expiresAt).toISOString(),
          now: new Date().toISOString()
        });
        this.remove(key);
        return null;
      }

      console.debug('✅ SafeStorage retrieved item successfully:', {
        key,
        hasValue: parsed.value !== null && parsed.value !== undefined,
        valueType: typeof parsed.value,
        timestamp: new Date(parsed.timestamp).toISOString(),
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt).toISOString() : 'never'
      });

      return parsed.value;
    } catch (error) {
      console.error(`❌ SafeStorage error getting item: ${key}`, {
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  // Set item with optional expiration
  set<T>(key: string, value: T, expiresInMs?: number): boolean {
    if (!this.isAvailable) {
      console.error('🚫 SafeStorage not available for key:', key);
      return false;
    }

    try {
      const now = Date.now();
      const item: StorageItem<T> = {
        value,
        timestamp: now,
        expiresAt: expiresInMs ? now + expiresInMs : undefined,
      };

      const serializedItem = JSON.stringify(item);
      console.debug('🔄 SafeStorage setting item:', {
        key,
        valueType: typeof value,
        valueLength: typeof value === 'string' ? value.length : 'N/A',
        hasExpiration: !!expiresInMs,
        expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString() : 'never',
        serializedLength: serializedItem.length,
        timestamp: new Date(now).toISOString()
      });

      localStorage.setItem(key, serializedItem);
      
      // Immediate verification with detailed logging
      const verification = localStorage.getItem(key);
      const success = verification === serializedItem;
      
      console.debug('✅ SafeStorage set verification:', {
        key,
        success,
        stored: !!verification,
        matches: success,
        verificationLength: verification?.length || 0,
        serializedLength: serializedItem.length
      });

      // If verification fails, provide more details
      if (!success) {
        console.error('❌ SafeStorage set verification failed:', {
          key,
          expectedLength: serializedItem.length,
          actualLength: verification?.length || 0,
          expectedStart: serializedItem.substring(0, 50),
          actualStart: verification?.substring(0, 50) || 'null'
        });
      }
      
      return success;
    } catch (error) {
      console.error(`❌ SafeStorage error setting item: ${key}`, {
        error: error.message,
        valueType: typeof value,
        stack: error.stack
      });
      return false;
    }
  }

  // Remove item
  remove(key: string): boolean {
    if (!this.isAvailable) return false;

    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing item from storage: ${key}`, error);
      return false;
    }
  }

  // Clear all items
  clear(): boolean {
    if (!this.isAvailable) return false;

    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing storage', error);
      return false;
    }
  }

  // Get all keys
  keys(): string[] {
    if (!this.isAvailable) return [];

    try {
      return Object.keys(localStorage);
    } catch (error) {
      console.error('Error getting storage keys', error);
      return [];
    }
  }

  // Get storage size in bytes (approximate)
  size(): number {
    if (!this.isAvailable) return 0;

    try {
      let total = 0;
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage[key].length + key.length;
        }
      }
      return total;
    } catch (error) {
      console.error('Error calculating storage size', error);
      return 0;
    }
  }
}

// Create singleton instance
export const storage = new SafeStorage();

// Specific storage keys used in the app
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'fluxion_auth_token',
  USER_PROFILE: 'fluxion_user_profile',
  WALLET_ADDRESS: 'fluxion_wallet_address',
  PREFERRED_NETWORK: 'fluxion_preferred_network',
  DRAFT_INVOICES: 'fluxion_draft_invoices',
  UI_PREFERENCES: 'fluxion_ui_preferences',
  ONBOARDING_COMPLETED: 'fluxion_onboarding_completed',
  RECENT_TRANSACTIONS: 'fluxion_recent_transactions',
  CACHED_ANALYTICS: 'fluxion_cached_analytics',
  NOTIFICATION_SETTINGS: 'fluxion_notification_settings',
} as const;

// Typed storage functions for specific data
export const authStorage = {
  getToken: (): string | null => {
    const token = storage.get<string>(STORAGE_KEYS.AUTH_TOKEN);
    console.debug('🔍 authStorage.getToken() called:', {
      tokenRetrieved: !!token,
      tokenLength: token?.length || 0,
      tokenPreview: token ? token.substring(0, 25) + '...' : 'null',
      storageKey: STORAGE_KEYS.AUTH_TOKEN,
      timestamp: new Date().toISOString()
    });
    return token;
  },
  
  setToken: (token: string, expiresInMs?: number): boolean => {
    console.debug('🔄 authStorage.setToken() called:', {
      tokenLength: token?.length || 0,
      hasExpiration: !!expiresInMs,
      expiresInMs,
      storageKey: STORAGE_KEYS.AUTH_TOKEN,
      timestamp: new Date().toISOString()
    });
    
    const result = storage.set(STORAGE_KEYS.AUTH_TOKEN, token, expiresInMs);
    
    // Immediate verification
    const verification = storage.get<string>(STORAGE_KEYS.AUTH_TOKEN);
    const success = verification === token;
    
    console.debug('🔍 authStorage.setToken() verification:', {
      storageResult: result,
      verificationSuccess: success,
      verifiedTokenLength: verification?.length || 0,
      tokensMatch: verification === token
    });
    
    return result && success;
  },
  
  removeToken: (): boolean => {
    console.debug('🗑️ authStorage.removeToken() called');
    return storage.remove(STORAGE_KEYS.AUTH_TOKEN);
  },

  isAuthenticated: (): boolean => {
    const isAuth = !!storage.get<string>(STORAGE_KEYS.AUTH_TOKEN);
    console.debug('🔍 authStorage.isAuthenticated() called:', { isAuthenticated: isAuth });
    return isAuth;
  },
};

export const userStorage = {
  getProfile: () => 
    storage.get<any>(STORAGE_KEYS.USER_PROFILE),
  
  setProfile: (profile: any): boolean => 
    storage.set(STORAGE_KEYS.USER_PROFILE, profile),
  
  removeProfile: (): boolean => 
    storage.remove(STORAGE_KEYS.USER_PROFILE),
};

export const walletStorage = {
  getAddress: (): string | null => 
    storage.get<string>(STORAGE_KEYS.WALLET_ADDRESS),
  
  setAddress: (address: string): boolean => 
    storage.set(STORAGE_KEYS.WALLET_ADDRESS, address),
  
  removeAddress: (): boolean => 
    storage.remove(STORAGE_KEYS.WALLET_ADDRESS),

  getPreferredNetwork: (): number | null => 
    storage.get<number>(STORAGE_KEYS.PREFERRED_NETWORK),
  
  setPreferredNetwork: (chainId: number): boolean => 
    storage.set(STORAGE_KEYS.PREFERRED_NETWORK, chainId),
};

export const draftStorage = {
  getDrafts: () => 
    storage.get<any[]>(STORAGE_KEYS.DRAFT_INVOICES) || [],
  
  setDrafts: (drafts: any[]): boolean => 
    storage.set(STORAGE_KEYS.DRAFT_INVOICES, drafts),
  
  addDraft: (draft: any): boolean => {
    const drafts = draftStorage.getDrafts();
    drafts.push({ ...draft, id: Date.now().toString() });
    return storage.set(STORAGE_KEYS.DRAFT_INVOICES, drafts);
  },

  removeDraft: (id: string): boolean => {
    const drafts = draftStorage.getDrafts();
    const filtered = drafts.filter(draft => draft.id !== id);
    return storage.set(STORAGE_KEYS.DRAFT_INVOICES, filtered);
  },

  clearDrafts: (): boolean => 
    storage.remove(STORAGE_KEYS.DRAFT_INVOICES),
};

export const uiStorage = {
  getPreferences: () => 
    storage.get<any>(STORAGE_KEYS.UI_PREFERENCES) || {},
  
  setPreferences: (preferences: any): boolean => 
    storage.set(STORAGE_KEYS.UI_PREFERENCES, preferences),
  
  updatePreference: (key: string, value: any): boolean => {
    const preferences = uiStorage.getPreferences();
    preferences[key] = value;
    return storage.set(STORAGE_KEYS.UI_PREFERENCES, preferences);
  },
};

export const onboardingStorage = {
  isCompleted: (): boolean => 
    storage.get<boolean>(STORAGE_KEYS.ONBOARDING_COMPLETED) || false,
  
  setCompleted: (completed: boolean = true): boolean => 
    storage.set(STORAGE_KEYS.ONBOARDING_COMPLETED, completed),
};

export const transactionStorage = {
  getRecent: () => 
    storage.get<any[]>(STORAGE_KEYS.RECENT_TRANSACTIONS) || [],
  
  addTransaction: (transaction: any): boolean => {
    const recent = transactionStorage.getRecent();
    recent.unshift(transaction);
    // Keep only last 50 transactions
    const trimmed = recent.slice(0, 50);
    return storage.set(STORAGE_KEYS.RECENT_TRANSACTIONS, trimmed);
  },

  clearRecent: (): boolean => 
    storage.remove(STORAGE_KEYS.RECENT_TRANSACTIONS),
};

export const analyticsStorage = {
  getCache: (key: string) => {
    const cache = storage.get<any>(STORAGE_KEYS.CACHED_ANALYTICS) || {};
    return cache[key];
  },

  setCache: (key: string, data: any, expiresInMs: number = 5 * 60 * 1000): boolean => {
    const cache = storage.get<any>(STORAGE_KEYS.CACHED_ANALYTICS) || {};
    cache[key] = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + expiresInMs,
    };
    return storage.set(STORAGE_KEYS.CACHED_ANALYTICS, cache);
  },

  clearCache: (): boolean => 
    storage.remove(STORAGE_KEYS.CACHED_ANALYTICS),

  isExpired: (key: string): boolean => {
    const cache = storage.get<any>(STORAGE_KEYS.CACHED_ANALYTICS) || {};
    const item = cache[key];
    return !item || Date.now() > item.expiresAt;
  },
};

export const notificationStorage = {
  getSettings: () => 
    storage.get<any>(STORAGE_KEYS.NOTIFICATION_SETTINGS) || {
      browser: true,
      email: true,
      sound: true,
    },
  
  setSettings: (settings: any): boolean => 
    storage.set(STORAGE_KEYS.NOTIFICATION_SETTINGS, settings),
  
  updateSetting: (key: string, value: boolean): boolean => {
    const settings = notificationStorage.getSettings();
    settings[key] = value;
    return storage.set(STORAGE_KEYS.NOTIFICATION_SETTINGS, settings);
  },
};

// Migration utilities for handling storage schema changes
export const migrationUtils = {
  getCurrentVersion: (): number => 
    storage.get<number>('fluxion_storage_version') || 1,
  
  setVersion: (version: number): boolean => 
    storage.set('fluxion_storage_version', version),

  migrateIfNeeded: (): void => {
    const currentVersion = migrationUtils.getCurrentVersion();
    const targetVersion = 2; // Update as needed

    if (currentVersion < targetVersion) {
      console.log(`Migrating storage from version ${currentVersion} to ${targetVersion}`);
      // Add migration logic here
      migrationUtils.setVersion(targetVersion);
    }
  },
};

// Initialize migration check
if (typeof window !== 'undefined') {
  migrationUtils.migrateIfNeeded();
}