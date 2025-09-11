// Admin Frontend Storage utilities with error handling and type safety
// Based on main frontend storage utilities for consistency

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
    if (!this.isAvailable) return null;

    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const parsed: StorageItem<T> = JSON.parse(item);
      
      // Check if item has expired
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        this.remove(key);
        return null;
      }

      return parsed.value;
    } catch (error) {
      console.error(`Error getting item from storage: ${key}`, error);
      return null;
    }
  }

  // Set item with optional expiration
  set<T>(key: string, value: T, expiresInMs?: number): boolean {
    if (!this.isAvailable) return false;

    try {
      const item: StorageItem<T> = {
        value,
        timestamp: Date.now(),
        expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined,
      };

      localStorage.setItem(key, JSON.stringify(item));
      return true;
    } catch (error) {
      console.error(`Error setting item in storage: ${key}`, error);
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
}

// Create singleton instance
export const storage = new SafeStorage();

// Admin-specific storage keys - using same pattern as main frontend but with admin prefix
export const ADMIN_STORAGE_KEYS = {
  AUTH_TOKEN: 'fluxion_admin_auth_token',
  USER_PROFILE: 'fluxion_admin_user_profile',
  WALLET_ADDRESS: 'fluxion_admin_wallet_address',
  UI_PREFERENCES: 'fluxion_admin_ui_preferences',
  RECENT_ACTIVITY: 'fluxion_admin_recent_activity',
  CACHED_STATS: 'fluxion_admin_cached_stats',
} as const;

// Typed storage functions for admin-specific data
export const adminAuthStorage = {
  getToken: (): string | null => 
    storage.get<string>(ADMIN_STORAGE_KEYS.AUTH_TOKEN),
  
  setToken: (token: string, expiresInMs?: number): boolean => 
    storage.set(ADMIN_STORAGE_KEYS.AUTH_TOKEN, token, expiresInMs),
  
  removeToken: (): boolean => 
    storage.remove(ADMIN_STORAGE_KEYS.AUTH_TOKEN),

  isAuthenticated: (): boolean => 
    !!storage.get<string>(ADMIN_STORAGE_KEYS.AUTH_TOKEN),
};

export const adminUserStorage = {
  getProfile: () => 
    storage.get<any>(ADMIN_STORAGE_KEYS.USER_PROFILE),
  
  setProfile: (profile: any): boolean => 
    storage.set(ADMIN_STORAGE_KEYS.USER_PROFILE, profile),
  
  removeProfile: (): boolean => 
    storage.remove(ADMIN_STORAGE_KEYS.USER_PROFILE),
};

export const adminWalletStorage = {
  getAddress: (): string | null => 
    storage.get<string>(ADMIN_STORAGE_KEYS.WALLET_ADDRESS),
  
  setAddress: (address: string): boolean => 
    storage.set(ADMIN_STORAGE_KEYS.WALLET_ADDRESS, address),
  
  removeAddress: (): boolean => 
    storage.remove(ADMIN_STORAGE_KEYS.WALLET_ADDRESS),
};

export const adminUiStorage = {
  getPreferences: () => 
    storage.get<any>(ADMIN_STORAGE_KEYS.UI_PREFERENCES) || {},
  
  setPreferences: (preferences: any): boolean => 
    storage.set(ADMIN_STORAGE_KEYS.UI_PREFERENCES, preferences),
  
  updatePreference: (key: string, value: any): boolean => {
    const preferences = adminUiStorage.getPreferences();
    preferences[key] = value;
    return storage.set(ADMIN_STORAGE_KEYS.UI_PREFERENCES, preferences);
  },
};

export const adminStatsStorage = {
  getCache: (key: string) => {
    const cache = storage.get<any>(ADMIN_STORAGE_KEYS.CACHED_STATS) || {};
    return cache[key];
  },

  setCache: (key: string, data: any, expiresInMs: number = 5 * 60 * 1000): boolean => {
    const cache = storage.get<any>(ADMIN_STORAGE_KEYS.CACHED_STATS) || {};
    cache[key] = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + expiresInMs,
    };
    return storage.set(ADMIN_STORAGE_KEYS.CACHED_STATS, cache);
  },

  clearCache: (): boolean => 
    storage.remove(ADMIN_STORAGE_KEYS.CACHED_STATS),

  isExpired: (key: string): boolean => {
    const cache = storage.get<any>(ADMIN_STORAGE_KEYS.CACHED_STATS) || {};
    const item = cache[key];
    return !item || Date.now() > item.expiresAt;
  },
};

// Migration utilities for handling storage schema changes
export const adminMigrationUtils = {
  getCurrentVersion: (): number => 
    storage.get<number>('fluxion_admin_storage_version') || 1,
  
  setVersion: (version: number): boolean => 
    storage.set('fluxion_admin_storage_version', version),

  migrateFromOldKeys: (): void => {
    // Migrate from old storage keys (jwt_token, admin_user_data) to new structured format
    try {
      const oldToken = localStorage.getItem('jwt_token');
      const oldUserData = localStorage.getItem('admin_user_data');

      if (oldToken && !adminAuthStorage.getToken()) {
        console.log('Migrating old auth token to new format');
        adminAuthStorage.setToken(oldToken);
        localStorage.removeItem('jwt_token');
      }

      if (oldUserData && !adminUserStorage.getProfile()) {
        console.log('Migrating old user data to new format');
        try {
          const parsedUserData = JSON.parse(oldUserData);
          adminUserStorage.setProfile(parsedUserData);
          localStorage.removeItem('admin_user_data');
        } catch (error) {
          console.error('Error parsing old user data:', error);
          localStorage.removeItem('admin_user_data');
        }
      }

      // Set version after migration
      adminMigrationUtils.setVersion(2);
    } catch (error) {
      console.error('Error during storage migration:', error);
    }
  },

  migrateIfNeeded: (): void => {
    const currentVersion = adminMigrationUtils.getCurrentVersion();
    const targetVersion = 2;

    if (currentVersion < targetVersion) {
      console.log(`Migrating admin storage from version ${currentVersion} to ${targetVersion}`);
      adminMigrationUtils.migrateFromOldKeys();
    }
  },
};

// Initialize migration check
if (typeof window !== 'undefined') {
  adminMigrationUtils.migrateIfNeeded();
}