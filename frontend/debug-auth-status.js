/**
 * Quick authentication debug script
 * Run this in the browser console to check auth status
 */

function debugAuthStatus() {
  console.log('=== AUTHENTICATION DEBUG REPORT ===');
  
  // Check all possible token storage locations
  const keys = [
    'fluxion_auth_token',
    'auth_token', 
    'token',
    'fluxion_token',
    'user_token',
    'authToken'
  ];
  
  const tokens = {};
  keys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      tokens[key] = {
        exists: !!value,
        length: value?.length || 0,
        preview: value ? value.substring(0, 30) + '...' : null,
        isJSON: (() => {
          try { JSON.parse(value); return true; } catch { return false; }
        })()
      };
    } catch (error) {
      tokens[key] = { error: error.message };
    }
  });
  
  console.table(tokens);
  
  // Check user profile storage
  const userKeys = ['fluxion_user_profile', 'user_profile', 'user'];
  const profiles = {};
  userKeys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      profiles[key] = {
        exists: !!value,
        length: value?.length || 0,
        isJSON: (() => {
          try { JSON.parse(value); return true; } catch { return false; }
        })()
      };
    } catch (error) {
      profiles[key] = { error: error.message };
    }
  });
  
  console.table(profiles);
  
  // Test API call with manual token
  const testToken = localStorage.getItem('fluxion_auth_token');
  if (testToken) {
    console.log('🧪 Testing API call with found token...');
    
    let actualToken = testToken;
    try {
      const parsed = JSON.parse(testToken);
      if (parsed.value) actualToken = parsed.value;
    } catch {}
    
    fetch('http://localhost:3000/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${actualToken}`,
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then(data => {
      console.log('🧪 API Test Result:', {
        status: 'success',
        authenticated: data.success,
        hasUser: !!data.data,
        error: data.error
      });
    })
    .catch(error => {
      console.log('🧪 API Test Result:', {
        status: 'error',
        error: error.message
      });
    });
  } else {
    console.log('❌ No token found for API testing');
  }
  
  return {
    tokens,
    profiles,
    recommendation: !Object.values(tokens).some(t => t.exists) 
      ? 'No tokens found. You need to connect wallet and authenticate.'
      : 'Tokens found. Check API call results above.'
  };
}

// Make it available globally
window.debugAuthStatus = debugAuthStatus;

console.log('🔧 Auth debug function loaded. Run: debugAuthStatus()');