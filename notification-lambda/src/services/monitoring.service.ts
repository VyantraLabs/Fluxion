/**
 * Comprehensive monitoring and observability service for Fluxion notifications
 * Handles metrics collection, health checks, and performance monitoring
 */

import { CloudWatchClient, PutMetricDataCommand, MetricDatum, Dimension } from '@aws-sdk/client-cloudwatch';
import { logger } from '../utils/logger';
import { config } from '../config';
import {
  NotificationMetrics,
  NotificationProcessingResult,
  NotificationType,
  NotificationChannel,
  NotificationPriority
} from '../types/notifications';

/**
 * Metric types for CloudWatch
 */
export interface CloudWatchMetric {
  MetricName: string;
  Value: number;
  Unit: 'Count' | 'Seconds' | 'Milliseconds' | 'Percent' | 'Bytes';
  Timestamp: Date;
  Dimensions?: Dimension[];
}

/**
 * Performance tracking interface
 */
export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  metadata?: Record<string, any>;
}

/**
 * Health check interface
 */
export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: Record<string, any>;
  timestamp: Date;
}

/**
 * Service monitoring and metrics collection
 */
export class MonitoringService {
  private cloudWatchClient: CloudWatchClient;
  private metrics: NotificationMetrics;
  private performanceMetrics: PerformanceMetric[] = [];
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = config.environment !== 'test';
    this.metrics = this.initializeMetrics();
    
    if (this.isEnabled) {
      const cloudWatchConfig: any = {
        region: config.aws.region,
        maxAttempts: 3
      };

      if (config.aws.accessKeyId && config.aws.secretAccessKey) {
        cloudWatchConfig.credentials = {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey
        };
      }

      this.cloudWatchClient = new CloudWatchClient(cloudWatchConfig);
      
      logger.info('Monitoring service initialized', {
        region: config.aws.region,
        enabled: this.isEnabled
      });
    }
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): NotificationMetrics {
    return {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      retries: 0,
      averageProcessingTimeMs: 0,
      channelBreakdown: {
        email: { sent: 0, failed: 0 },
        webhook: { sent: 0, failed: 0 },
        sms: { sent: 0, failed: 0 }
      },
      typeBreakdown: {},
      providerBreakdown: {
        ses: { sent: 0, failed: 0 },
        sendgrid: { sent: 0, failed: 0 },
        smtp: { sent: 0, failed: 0 }
      }
    };
  }

  /**
   * Record notification processing result
   */
  recordNotificationResult(result: NotificationProcessingResult): void {
    this.metrics.totalProcessed++;
    
    if (result.status === 'sent') {
      this.metrics.successful++;
    } else {
      this.metrics.failed++;
    }

    // Update average processing time
    this.metrics.averageProcessingTimeMs = 
      (this.metrics.averageProcessingTimeMs * (this.metrics.totalProcessed - 1) + result.processingTimeMs) / 
      this.metrics.totalProcessed;

    // Update channel breakdown
    for (const channel of result.channels) {
      const channelResult = result.results[channel];
      if (channelResult && 'status' in channelResult) {
        if (channelResult.status === 'sent') {
          this.metrics.channelBreakdown[channel].sent++;
        } else {
          this.metrics.channelBreakdown[channel].failed++;
        }
      }
    }

    // Update type breakdown
    if (!this.metrics.typeBreakdown[result.type]) {
      this.metrics.typeBreakdown[result.type] = { sent: 0, failed: 0 };
    }
    
    if (result.status === 'sent') {
      this.metrics.typeBreakdown[result.type].sent++;
    } else {
      this.metrics.typeBreakdown[result.type].failed++;
    }

    // Update provider breakdown (from email results)
    if (result.results.email && 'provider' in result.results.email) {
      const provider = result.results.email.provider as keyof NotificationMetrics['providerBreakdown'];
      if (this.metrics.providerBreakdown[provider]) {
        if (result.results.email.status === 'sent') {
          this.metrics.providerBreakdown[provider].sent++;
        } else {
          this.metrics.providerBreakdown[provider].failed++;
        }
      }
    }

    logger.performance('notification_processed', result.processingTimeMs, {
      type: result.type,
      status: result.status,
      channels: result.channels
    });
  }

  /**
   * Record performance metric
   */
  recordPerformance(
    operation: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: new Date(),
      success,
      metadata
    };

    this.performanceMetrics.push(metric);

    // Keep only recent metrics (last 1000)
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(-1000);
    }

    logger.performance(operation, duration, {
      success,
      ...metadata
    });
  }

  /**
   * Send metrics to CloudWatch
   */
  async sendMetricsToCloudWatch(namespace: string = 'Fluxion/NotificationLambda'): Promise<void> {
    if (!this.isEnabled) {
      logger.debug('CloudWatch metrics disabled in test environment');
      return;
    }

    try {
      const metricData: MetricDatum[] = [];
      const timestamp = new Date();

      // Basic metrics
      metricData.push(
        {
          MetricName: 'NotificationProcessed',
          Value: this.metrics.totalProcessed,
          Unit: 'Count',
          Timestamp: timestamp
        },
        {
          MetricName: 'NotificationSuccessful',
          Value: this.metrics.successful,
          Unit: 'Count',
          Timestamp: timestamp
        },
        {
          MetricName: 'NotificationFailed',
          Value: this.metrics.failed,
          Unit: 'Count',
          Timestamp: timestamp
        },
        {
          MetricName: 'NotificationRetries',
          Value: this.metrics.retries,
          Unit: 'Count',
          Timestamp: timestamp
        },
        {
          MetricName: 'AverageProcessingTime',
          Value: this.metrics.averageProcessingTimeMs,
          Unit: 'Milliseconds',
          Timestamp: timestamp
        }
      );\n\n      // Success rate\n      if (this.metrics.totalProcessed > 0) {\n        const successRate = (this.metrics.successful / this.metrics.totalProcessed) * 100;\n        metricData.push({\n          MetricName: 'SuccessRate',\n          Value: successRate,\n          Unit: 'Percent',\n          Timestamp: timestamp\n        });\n      }\n\n      // Channel metrics\n      for (const [channel, stats] of Object.entries(this.metrics.channelBreakdown)) {\n        metricData.push(\n          {\n            MetricName: 'ChannelSuccess',\n            Value: stats.sent,\n            Unit: 'Count',\n            Timestamp: timestamp,\n            Dimensions: [{ Name: 'Channel', Value: channel }]\n          },\n          {\n            MetricName: 'ChannelFailed',\n            Value: stats.failed,\n            Unit: 'Count',\n            Timestamp: timestamp,\n            Dimensions: [{ Name: 'Channel', Value: channel }]\n          }\n        );\n      }\n\n      // Type metrics\n      for (const [type, stats] of Object.entries(this.metrics.typeBreakdown)) {\n        metricData.push(\n          {\n            MetricName: 'TypeSuccess',\n            Value: stats.sent,\n            Unit: 'Count',\n            Timestamp: timestamp,\n            Dimensions: [{ Name: 'NotificationType', Value: type }]\n          },\n          {\n            MetricName: 'TypeFailed',\n            Value: stats.failed,\n            Unit: 'Count',\n            Timestamp: timestamp,\n            Dimensions: [{ Name: 'NotificationType', Value: type }]\n          }\n        );\n      }\n\n      // Provider metrics\n      for (const [provider, stats] of Object.entries(this.metrics.providerBreakdown)) {\n        metricData.push(\n          {\n            MetricName: 'ProviderSuccess',\n            Value: stats.sent,\n            Unit: 'Count',\n            Timestamp: timestamp,\n            Dimensions: [{ Name: 'EmailProvider', Value: provider }]\n          },\n          {\n            MetricName: 'ProviderFailed',\n            Value: stats.failed,\n            Unit: 'Count',\n            Timestamp: timestamp,\n            Dimensions: [{ Name: 'EmailProvider', Value: provider }]\n          }\n        );\n      }\n\n      // Send in batches (CloudWatch limit is 20 metrics per request)\n      const batchSize = 20;\n      for (let i = 0; i < metricData.length; i += batchSize) {\n        const batch = metricData.slice(i, i + batchSize);\n        \n        const command = new PutMetricDataCommand({\n          Namespace: namespace,\n          MetricData: batch\n        });\n\n        await this.cloudWatchClient.send(command);\n      }\n\n      logger.info('Metrics sent to CloudWatch', {\n        namespace,\n        metricsCount: metricData.length,\n        batchCount: Math.ceil(metricData.length / batchSize)\n      });\n\n    } catch (error) {\n      logger.error('Failed to send metrics to CloudWatch', {\n        namespace,\n        error: error instanceof Error ? error.message : error\n      });\n    }\n  }\n\n  /**\n   * Perform health check on a service\n   */\n  async performHealthCheck(\n    serviceName: string,\n    checkFunction: () => Promise<boolean>,\n    timeout: number = 5000\n  ): Promise<HealthCheckResult> {\n    const startTime = Date.now();\n    \n    try {\n      const timeoutPromise = new Promise<boolean>((_, reject) => {\n        setTimeout(() => reject(new Error('Health check timeout')), timeout);\n      });\n\n      const isHealthy = await Promise.race([\n        checkFunction(),\n        timeoutPromise\n      ]);\n\n      const responseTime = Date.now() - startTime;\n      \n      const result: HealthCheckResult = {\n        service: serviceName,\n        status: isHealthy ? 'healthy' : 'degraded',\n        responseTime,\n        timestamp: new Date()\n      };\n\n      this.healthChecks.set(serviceName, result);\n      return result;\n\n    } catch (error) {\n      const responseTime = Date.now() - startTime;\n      \n      const result: HealthCheckResult = {\n        service: serviceName,\n        status: 'unhealthy',\n        responseTime,\n        details: {\n          error: error instanceof Error ? error.message : String(error)\n        },\n        timestamp: new Date()\n      };\n\n      this.healthChecks.set(serviceName, result);\n      return result;\n    }\n  }\n\n  /**\n   * Get comprehensive health status\n   */\n  getHealthStatus(): {\n    overall: 'healthy' | 'degraded' | 'unhealthy';\n    services: HealthCheckResult[];\n    metrics: NotificationMetrics;\n    uptime: number;\n  } {\n    const services = Array.from(this.healthChecks.values());\n    \n    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';\n    \n    if (services.some(s => s.status === 'unhealthy')) {\n      overall = 'unhealthy';\n    } else if (services.some(s => s.status === 'degraded')) {\n      overall = 'degraded';\n    }\n\n    return {\n      overall,\n      services,\n      metrics: this.getMetrics(),\n      uptime: process.uptime() * 1000 // Convert to milliseconds\n    };\n  }\n\n  /**\n   * Get current metrics snapshot\n   */\n  getMetrics(): NotificationMetrics {\n    return { ...this.metrics };\n  }\n\n  /**\n   * Get performance metrics summary\n   */\n  getPerformanceMetrics(operation?: string): {\n    totalOperations: number;\n    averageDuration: number;\n    successRate: number;\n    operations: string[];\n    recent: PerformanceMetric[];\n  } {\n    let filteredMetrics = this.performanceMetrics;\n    \n    if (operation) {\n      filteredMetrics = this.performanceMetrics.filter(m => m.operation === operation);\n    }\n\n    if (filteredMetrics.length === 0) {\n      return {\n        totalOperations: 0,\n        averageDuration: 0,\n        successRate: 0,\n        operations: [],\n        recent: []\n      };\n    }\n\n    const totalOperations = filteredMetrics.length;\n    const averageDuration = filteredMetrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations;\n    const successCount = filteredMetrics.filter(m => m.success).length;\n    const successRate = (successCount / totalOperations) * 100;\n    \n    const operations = [...new Set(this.performanceMetrics.map(m => m.operation))];\n    const recent = filteredMetrics.slice(-10); // Last 10 operations\n\n    return {\n      totalOperations,\n      averageDuration,\n      successRate,\n      operations,\n      recent\n    };\n  }\n\n  /**\n   * Create custom metric\n   */\n  async sendCustomMetric(\n    metricName: string,\n    value: number,\n    unit: 'Count' | 'Seconds' | 'Milliseconds' | 'Percent' | 'Bytes',\n    dimensions?: { [key: string]: string },\n    namespace: string = 'Fluxion/NotificationLambda'\n  ): Promise<void> {\n    if (!this.isEnabled) {\n      logger.debug('Custom metric not sent - monitoring disabled');\n      return;\n    }\n\n    try {\n      const metricDimensions: Dimension[] = dimensions ? \n        Object.entries(dimensions).map(([key, value]) => ({ Name: key, Value: value })) : \n        [];\n\n      const command = new PutMetricDataCommand({\n        Namespace: namespace,\n        MetricData: [{\n          MetricName: metricName,\n          Value: value,\n          Unit: unit,\n          Timestamp: new Date(),\n          Dimensions: metricDimensions\n        }]\n      });\n\n      await this.cloudWatchClient.send(command);\n      \n      logger.debug('Custom metric sent', {\n        metricName,\n        value,\n        unit,\n        dimensions\n      });\n\n    } catch (error) {\n      logger.error('Failed to send custom metric', {\n        metricName,\n        error: error instanceof Error ? error.message : error\n      });\n    }\n  }\n\n  /**\n   * Reset metrics (useful for testing or periodic resets)\n   */\n  resetMetrics(): void {\n    this.metrics = this.initializeMetrics();\n    this.performanceMetrics = [];\n    this.healthChecks.clear();\n    \n    logger.info('Monitoring metrics reset');\n  }\n\n  /**\n   * Create CloudWatch dashboard configuration (returns JSON)\n   */\n  createDashboardConfig(): any {\n    return {\n      widgets: [\n        {\n          type: 'metric',\n          properties: {\n            metrics: [\n              ['Fluxion/NotificationLambda', 'NotificationProcessed'],\n              ['.', 'NotificationSuccessful'],\n              ['.', 'NotificationFailed']\n            ],\n            period: 300,\n            stat: 'Sum',\n            region: config.aws.region,\n            title: 'Notification Processing Overview'\n          }\n        },\n        {\n          type: 'metric',\n          properties: {\n            metrics: [\n              ['Fluxion/NotificationLambda', 'SuccessRate']\n            ],\n            period: 300,\n            stat: 'Average',\n            region: config.aws.region,\n            title: 'Success Rate',\n            yAxis: {\n              left: {\n                min: 0,\n                max: 100\n              }\n            }\n          }\n        },\n        {\n          type: 'metric',\n          properties: {\n            metrics: [\n              ['Fluxion/NotificationLambda', 'AverageProcessingTime']\n            ],\n            period: 300,\n            stat: 'Average',\n            region: config.aws.region,\n            title: 'Processing Time'\n          }\n        },\n        {\n          type: 'metric',\n          properties: {\n            metrics: [\n              ['Fluxion/NotificationLambda', 'ChannelSuccess', 'Channel', 'email'],\n              ['...', 'webhook'],\n              ['...', 'sms'],\n              ['Fluxion/NotificationLambda', 'ChannelFailed', 'Channel', 'email'],\n              ['...', 'webhook'],\n              ['...', 'sms']\n            ],\n            period: 300,\n            stat: 'Sum',\n            region: config.aws.region,\n            title: 'Channel Performance'\n          }\n        }\n      ]\n    };\n  }\n}\n\n// Singleton instance\nexport const monitoringService = new MonitoringService();"}, {"old_string": "", "new_string": ""}]