import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

export interface LambdaEvent extends APIGatewayProxyEvent {
  // Additional custom properties if needed
  customHeaders?: Record<string, string>;
  organizationId?: string;
  userId?: string;
}

export interface LambdaResult extends APIGatewayProxyResult {
  // Additional custom properties if needed
}

export interface LambdaContext extends Context {
  // Additional custom properties if needed
}

export type LambdaHandler<T = any, R = any> = (
  event: T,
  context: LambdaContext
) => Promise<R>;

export type ApiGatewayHandler = LambdaHandler<LambdaEvent, LambdaResult>;

// Environment configuration types
export interface LambdaEnvironmentConfig {
  NODE_ENV: string;
  LOG_LEVEL: string;
  DB_HOST: string;
  DB_PORT: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  NOTIFICATION_QUEUE_URL?: string;
  S3_BUCKET_NAME?: string;
  AWS_REGION: string;
}

// Lambda function configuration
export interface LambdaFunctionConfig {
  functionName: string;
  runtime: string;
  handler: string;
  codeUri: string;
  timeout: number;
  memorySize: number;
  environment: {
    Variables: Partial<LambdaEnvironmentConfig>;
  };
  events: LambdaEventConfig[];
  layers?: string[];
  policies?: string[];
  vpc?: {
    SecurityGroupIds: string[];
    SubnetIds: string[];
  };
}

export interface LambdaEventConfig {
  type: 'Api' | 'Schedule' | 'SQS' | 'S3';
  properties: ApiEventProperties | ScheduleEventProperties | SQSEventProperties | S3EventProperties;
}

export interface ApiEventProperties {
  Path: string;
  Method: string;
  RestApiId?: string;
  Auth?: {
    Authorizer?: string;
  };
  Cors?: {
    AllowMethods: string;
    AllowHeaders: string;
    AllowOrigin: string;
  };
}

export interface ScheduleEventProperties {
  Schedule: string;
  Name?: string;
  Description?: string;
  Enabled?: boolean;
}

export interface SQSEventProperties {
  Queue: string;
  BatchSize?: number;
  MaximumBatchingWindowInSeconds?: number;
}

export interface S3EventProperties {
  Bucket: string;
  Events: string[];
  Filter?: {
    S3Key: {
      Rules: Array<{
        Name: string;
        Value: string;
      }>;
    };
  };
}

// Deployment configuration
export interface DeploymentConfig {
  environment: 'dev' | 'staging' | 'production';
  region: string;
  stackName: string;
  s3Bucket?: string;
  s3Prefix?: string;
  parameters?: Record<string, string>;
  tags?: Record<string, string>;
}

// SAM template types
export interface SAMTemplate {
  AWSTemplateFormatVersion: string;
  Transform: string;
  Description?: string;
  Parameters?: Record<string, SAMParameter>;
  Globals?: {
    Function?: {
      Runtime?: string;
      Timeout?: number;
      MemorySize?: number;
      Environment?: {
        Variables?: Record<string, string>;
      };
      Layers?: string[];
      VpcConfig?: {
        SecurityGroupIds: string[];
        SubnetIds: string[];
      };
    };
    Api?: {
      Cors?: {
        AllowMethods: string;
        AllowHeaders: string;
        AllowOrigin: string;
      };
      Auth?: {
        DefaultAuthorizer?: string;
        Authorizers?: Record<string, any>;
      };
    };
  };
  Resources: Record<string, SAMResource>;
  Outputs?: Record<string, SAMOutput>;
}

export interface SAMParameter {
  Type: string;
  Default?: string;
  Description?: string;
  AllowedValues?: string[];
  MinLength?: number;
  MaxLength?: number;
}

export interface SAMResource {
  Type: string;
  Properties: any;
  DependsOn?: string | string[];
  Condition?: string;
}

export interface SAMOutput {
  Description: string;
  Value: any;
  Export?: {
    Name: string;
  };
}

// Build configuration
export interface BuildConfig {
  serviceName: string;
  sourceDir: string;
  buildDir: string;
  entryPoint: string;
  external?: string[];
  minify?: boolean;
  sourcemap?: boolean;
  target?: string;
  platform?: string;
}

// Shared library packaging configuration
export interface SharedLibraryConfig {
  name: string;
  version: string;
  sourcePath: string;
  buildPath: string;
  includePatterns: string[];
  excludePatterns: string[];
  dependencies: string[];
}

export interface LambdaDeploymentError extends Error {
  code: string;
  service?: string;
  stage?: string;
  details?: any;
}

// Lambda runtime metrics
export interface LambdaMetrics {
  duration: number;
  billedDuration: number;
  memorySize: number;
  maxMemoryUsed: number;
  initDuration?: number;
  requestId: string;
  functionName: string;
  functionVersion: string;
}

// Custom authorizer types
export interface AuthorizerEvent {
  type: string;
  authorizationToken?: string;
  methodArn: string;
  headers?: Record<string, string>;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  requestContext: {
    accountId: string;
    apiId: string;
    httpMethod: string;
    requestId: string;
    resourcePath: string;
    stage: string;
  };
}

export interface AuthorizerPolicy {
  principalId: string;
  policyDocument: {
    Version: string;
    Statement: Array<{
      Action: string;
      Effect: 'Allow' | 'Deny';
      Resource: string;
    }>;
  };
  context?: Record<string, any>;
}

export type AuthorizerHandler = LambdaHandler<AuthorizerEvent, AuthorizerPolicy>;