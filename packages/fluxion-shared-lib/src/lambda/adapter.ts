import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Express } from 'express';
import serverlessExpress from '@codegenie/serverless-express';
import { Logger } from '../utils/logger';

const logger = new Logger('LambdaAdapter');

export interface LambdaAdapterOptions {
  binaryMimeTypes?: string[];
  requestWaitTime?: number;
  resolutionMode?: 'PROMISE' | 'CALLBACK';
}

export class LambdaAdapter {
  private handler: any;
  private app: Express;
  private options: LambdaAdapterOptions;

  constructor(app: Express, options: LambdaAdapterOptions = {}) {
    this.app = app;
    this.options = {
      binaryMimeTypes: [],
      requestWaitTime: 10000,
      resolutionMode: 'PROMISE',
      ...options
    };

    // Create serverless express handler
    this.handler = serverlessExpress({ app: this.app });
  }

  /**
   * Lambda handler function
   */
  public handleRequest = async (
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> => {
    try {
      logger.info('Lambda handler invoked', {
        httpMethod: event.httpMethod,
        path: event.path,
        requestId: context.awsRequestId,
        functionName: context.functionName,
        functionVersion: context.functionVersion
      });

      // Set Lambda context for logging
      context.callbackWaitsForEmptyEventLoop = false;

      const result = await this.handler(event, context);
      
      logger.info('Lambda handler completed', {
        statusCode: result.statusCode,
        requestId: context.awsRequestId
      });

      return result;
    } catch (error) {
      logger.error('Lambda handler error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requestId: context.awsRequestId,
        event: JSON.stringify(event)
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
            requestId: context.awsRequestId
          }
        })
      };
    }
  };

  /**
   * Warm-up function for Lambda containers
   */
  public warmup = async (event: any, context: Context): Promise<any> => {
    logger.info('Lambda warmup invoked', {
      functionName: context.functionName,
      requestId: context.awsRequestId
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Lambda function warmed up',
        timestamp: new Date().toISOString(),
        functionName: context.functionName
      })
    };
  };
}

/**
 * Factory function to create Lambda adapter
 */
export function createLambdaAdapter(
  app: Express, 
  options?: LambdaAdapterOptions
): LambdaAdapter {
  return new LambdaAdapter(app, options);
}

/**
 * Helper function to create Lambda handler from Express app
 */
export function createLambdaHandler(
  app: Express,
  options?: LambdaAdapterOptions
) {
  const adapter = new LambdaAdapter(app, options);
  return adapter.handleRequest;
}

/**
 * Health check handler for Lambda functions
 */
export const healthCheckHandler = async (
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
      timestamp: new Date().toISOString(),
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      requestId: context.awsRequestId
    })
  };
};