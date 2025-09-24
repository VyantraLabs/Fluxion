/**
 * Lambda Authorizer for Fluxion API Gateway
 * Validates JWT tokens and authorizes API requests
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Generate IAM policy for API Gateway
 */
function generatePolicy(principalId, effect, resource, context = {}) {
  const authResponse = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    },
    context
  };

  return authResponse;
}

/**
 * Extract token from authorization header
 */
function extractToken(authorizationToken) {
  if (!authorizationToken) {
    throw new Error('Missing Authorization header');
  }

  const parts = authorizationToken.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new Error('Invalid Authorization header format');
  }

  return parts[1];
}

/**
 * Main authorizer handler
 */
exports.handler = async (event, context) => {
  console.log('Authorizer event:', JSON.stringify(event, null, 2));

  try {
    const token = extractToken(event.authorizationToken);
    
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    console.log('Token verified successfully:', {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      role: decoded.role
    });

    // Allow access and pass user context
    const policy = generatePolicy(
      decoded.userId,
      'Allow',
      event.methodArn,
      {
        userId: decoded.userId,
        organizationId: decoded.organizationId || '',
        role: decoded.role || 'user',
        email: decoded.email || '',
        walletAddress: decoded.walletAddress || ''
      }
    );

    console.log('Generated policy:', JSON.stringify(policy, null, 2));
    return policy;

  } catch (error) {
    console.error('Authorization failed:', error.message);
    
    // For development, return more detailed error info
    if (process.env.NODE_ENV === 'development') {
      console.error('Full error:', error);
    }
    
    // Return Deny policy
    return generatePolicy(
      'unknown',
      'Deny',
      event.methodArn,
      {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    );
  }
};