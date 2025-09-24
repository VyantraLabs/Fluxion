import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { LambdaMetrics, LambdaEnvironmentConfig } from './types';
import { Logger } from '../utils/logger';

const logger = new Logger('LambdaUtils');

/**
 * Extract and validate environment variables for Lambda functions
 */
export function getEnvironmentConfig(): Partial<LambdaEnvironmentConfig> {
  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT || '5432',
    DB_USERNAME: process.env.DB_USERNAME || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || 'password',
    DB_DATABASE: process.env.DB_DATABASE || 'fluxion_dev',
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    JWT_SECRET: process.env.JWT_SECRET || 'default-secret',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    NOTIFICATION_QUEUE_URL: process.env.NOTIFICATION_QUEUE_URL,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    AWS_REGION: process.env.AWS_REGION || 'us-east-1'
  };
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(required: (keyof LambdaEnvironmentConfig)[]): void {
  const config = getEnvironmentConfig();
  const missing: string[] = [];

  for (const key of required) {
    if (!config[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Parse Lambda event and extract common properties
 */
export function parseEvent(event: APIGatewayProxyEvent) {
  const { httpMethod, path, pathParameters, queryStringParameters, headers, body } = event;
  
  // Extract authorization token
  const authHeader = headers?.['Authorization'] || headers?.['authorization'];
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  
  // Parse request body
  let parsedBody: any = null;
  if (body) {
    try {
      parsedBody = JSON.parse(body);
    } catch (error) {
      logger.warn('Failed to parse request body as JSON', { body });
      parsedBody = body;
    }
  }

  // Extract user context from headers (set by authorizer)
  const userContext = {
    userId: headers?.['x-user-id'],
    organizationId: headers?.['x-organization-id'],
    role: headers?.['x-user-role']
  };

  return {
    method: httpMethod,
    path,
    pathParameters: pathParameters || {},
    queryParameters: queryStringParameters || {},
    headers: headers || {},
    body: parsedBody,
    token,
    userContext,
    rawEvent: event
  };
}

/**
 * Generate standardized Lambda response
 */
export function createResponse(
  statusCode: number,
  data?: any,
  headers?: Record<string, string>
) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  return {
    statusCode,
    headers: { ...defaultHeaders, ...headers },
    body: JSON.stringify(data)
  };
}

/**
 * Create success response
 */
export function successResponse(data: any, statusCode: number = 200, headers?: Record<string, string>) {
  return createResponse(statusCode, {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString()
    }
  }, headers);
}

/**
 * Create error response
 */
export function errorResponse(
  error: string | Error,
  statusCode: number = 500,
  code?: string,
  details?: any
) {
  const errorData = {
    success: false,
    error: {
      code: code || 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : error,
      details
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  };

  return createResponse(statusCode, errorData);
}

/**
 * Extract Lambda runtime metrics
 */
export function extractMetrics(context: Context): Partial<LambdaMetrics> {
  return {
    requestId: context.awsRequestId,
    functionName: context.functionName,
    functionVersion: context.functionVersion,
    memorySize: Number(context.memoryLimitInMB)
  };
}

/**
 * Log Lambda invocation details
 */
export function logInvocation(event: APIGatewayProxyEvent, context: Context) {
  const metrics = extractMetrics(context);
  const { method, path, userContext } = parseEvent(event);
  
  logger.info('Lambda invocation', {
    ...metrics,
    httpMethod: method,
    path,
    userId: userContext.userId,
    organizationId: userContext.organizationId,
    stage: event.requestContext?.stage
  });
}

/**
 * Handle Lambda function timeout
 */
export function setupTimeoutHandler(context: Context, timeoutBuffer: number = 5000) {
  const timeoutId = setTimeout(() => {
    logger.warn('Lambda function approaching timeout', {
      remainingTime: context.getRemainingTimeInMillis(),
      functionName: context.functionName,
      requestId: context.awsRequestId
    });
  }, Math.max(0, context.getRemainingTimeInMillis() - timeoutBuffer));

  return () => clearTimeout(timeoutId);
}

/**
 * Validate API Gateway event structure
 */
export function validateEvent(event: APIGatewayProxyEvent): boolean {
  return !!(
    event &&
    event.httpMethod &&
    event.path &&
    event.requestContext
  );
}

/**
 * Extract correlation ID for request tracing
 */
export function getCorrelationId(event: APIGatewayProxyEvent, context: Context): string {
  return event.headers?.['x-correlation-id'] || 
         event.headers?.['X-Correlation-ID'] || 
         context.awsRequestId;
}

/**
 * Check if Lambda is running in cold start
 */
let isWarmStart = false;
export function isColdStart(): boolean {
  if (isWarmStart) {
    return false;
  }
  isWarmStart = true;
  return true;
}

/**
 * Lambda warmup detector
 */
export function isWarmupEvent(event: any): boolean {
  return !!(
    event &&
    (event.source === 'warmup' ||
     event.detail?.source === 'warmup' ||
     event.Records?.[0]?.eventSource === 'warmup')
  );
}

/**
 * Extract service name from function name
 */
export function getServiceName(functionName: string): string {
  // Extract service name from function name pattern: fluxion-{env}-{service}-{function}
  const parts = functionName.split('-');
  if (parts.length >= 3) {
    return parts[2]; // service name
  }
  return 'unknown';
}

/**
 * Get deployment stage from context or environment
 */
export function getDeploymentStage(event?: APIGatewayProxyEvent): string {
  return event?.requestContext?.stage || 
         process.env.STAGE || 
         process.env.NODE_ENV || 
         'development';
}

/**
 * Format Lambda function ARN
 */
export function formatFunctionArn(
  region: string,
  accountId: string,
  functionName: string,
  qualifier?: string
): string {
  const baseArn = `arn:aws:lambda:${region}:${accountId}:function:${functionName}`;
  return qualifier ? `${baseArn}:${qualifier}` : baseArn;
}

/**
 * Create Lambda response with CORS headers
 */
export function corsResponse(
  statusCode: number,
  data?: any,
  origin?: string
) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true'
    },
    body: data ? JSON.stringify(data) : ''
  };
}

/**
 * Handle OPTIONS preflight requests
 */
export function handlePreflight(origin?: string) {
  return corsResponse(200, { message: 'OK' }, origin);
}

/**
 * Sanitize sensitive data from logs
 */
export function sanitizeForLogging(obj: any): any {
  const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'cookie'];
  
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogging);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}