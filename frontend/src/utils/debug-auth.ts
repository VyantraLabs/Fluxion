// Debug authentication utilities
import { authStorage, userStorage } from './storage';

export const debugAuth = {
  checkToken: () => {
    const token = authStorage.getToken();
    const user = userStorage.getProfile();
    
    console.group('🔐 Authentication Debug');
    console.log('Token exists:', !!token);
    if (token) {
      console.log('Token length:', token.length);
      console.log('Token preview:', token.substring(0, 50) + '...');
      
      // Try to decode JWT (base64)
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          console.log('Token payload:', payload);
          console.log('Token expires:', new Date(payload.exp * 1000));
          console.log('Token issued:', new Date(payload.iat * 1000));
        }
      } catch (e) {
        console.error('Failed to decode token:', e);
      }
    }
    
    console.log('User profile:', user);
    console.log('LocalStorage keys:', Object.keys(localStorage));
    console.log('Auth token key in localStorage:', localStorage.getItem('fluxion_auth_token'));
    console.groupEnd();
    
    return { token, user };
  },
  
  clearAuth: () => {
    console.log('Clearing authentication...');
    authStorage.removeToken();
    userStorage.removeProfile();
    console.log('Authentication cleared');
  },
  
  setMockToken: () => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMDFLNEZXUEc';
    authStorage.setToken(mockToken, 24 * 60 * 60 * 1000);
    console.log('Mock token set');
  }
};

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).debugAuth = debugAuth;
}