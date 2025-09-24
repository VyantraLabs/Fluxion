/**
 * Lambda Handler for Admin Service
 * Adapts Express app to run in AWS Lambda environment
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLambdaAdapter, isWarmupEvent } from '@fluxion/shared-lib/lambda/adapter';
import { validateEnvironment, logInvocation } from '@fluxion/shared-lib/lambda/utils';
import { app } from './app';
import { Logger } from '@fluxion/shared-lib/utils/logger';

const logger = new Logger('AdminServiceLambda');

// Validate critical environment variables for Lambda
const requiredEnvVars = [
  'JWT_SECRET',
  'DB_HOST',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE'
];

try {
  validateEnvironment(requiredEnvVars);
  logger.info('Lambda environment validation passed', {
    service: 'admin-service',
    nodeEnv: process.env.NODE_ENV,
    awsRegion: process.env.AWS_REGION
  });
} catch (error) {
  logger.error('Lambda environment validation failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    service: 'admin-service'
  });
  throw error;
}

// Create Lambda adapter
const lambdaAdapter = createLambdaAdapter(app, {
  binaryMimeTypes: [
    'multipart/form-data',
    'image/*',
    'application/pdf',
    'application/octet-stream'
  ],
  requestWaitTime: 10000
});

/**
 * Main Lambda handler function
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Handle warmup events
  if (isWarmupEvent(event)) {
    logger.info('Warmup event received', {
      functionName: context.functionName,
      requestId: context.awsRequestId
    });
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Lambda warmed up',
        service: 'admin-service',
        timestamp: new Date().toISOString()
      })
    };
  }

  // Log invocation details
  logInvocation(event, context);

  try {
    // Use the Lambda adapter to handle the request
    const result = await lambdaAdapter.handler(event, context);
    
    logger.info('Request processed successfully', {
      statusCode: result.statusCode,
      requestId: context.awsRequestId,
      service: 'admin-service',
      path: event.path,
      method: event.httpMethod
    });

    return result;
  } catch (error) {
    logger.error('Lambda handler error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestId: context.awsRequestId,
      service: 'admin-service',
      path: event.path,
      method: event.httpMethod
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          requestId: context.awsRequestId,
          service: 'admin-service'
        },
        metadata: {
          timestamp: new Date().toISOString()
        }
      })
    };
  }
};

/**
 * Health check handler for Lambda
 */
export const healthCheck = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'healthy',
      service: 'admin-service',
      timestamp: new Date().toISOString(),
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      requestId: context.awsRequestId,
      environment: process.env.NODE_ENV || 'unknown'
    })
  };
};

/**
 * Warmup handler for Lambda
 */
export const warmup = async (
  event: any,
  context: Context
): Promise<any> => {
  logger.info('Warmup handler invoked', {
    functionName: context.functionName,
    requestId: context.awsRequestId,
    service: 'admin-service'
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Admin service warmed up successfully',
      service: 'admin-service',
      timestamp: new Date().toISOString(),
      functionName: context.functionName
    })
  };
};