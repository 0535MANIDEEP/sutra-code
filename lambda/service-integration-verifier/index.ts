import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import axios from 'axios';

// Environment variables
const REGION = process.env.AWS_REGION || 'ap-south-1';
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN!;
const AUDIO_STORAGE_BUCKET = process.env.AUDIO_STORAGE_BUCKET!;
const BHASHINI_BASE_URL = process.env.BHASHINI_BASE_URL || 'https://dhruva-api.bhashini.gov.in/services';
const BHASHINI_API_KEY = process.env.BHASHINI_API_KEY || 'placeholder-key';

// Initialize AWS clients
const bedrockClient = new BedrockRuntimeClient({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const s3Client = new S3Client({ region: REGION });
const snsClient = new SNSClient({ region: REGION });
const cloudWatchClient = new CloudWatchClient({ region: REGION });

// Claude 3 Haiku model ID
const CLAUDE_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0';

// Service health check interfaces
interface ServiceHealthCheck {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastChecked: number;
  errorMessage?: string;
  details?: any;
}

interface IntegrationVerificationResult {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealthCheck[];
  timestamp: number;
  recommendations: string[];
}

// DynamoDB tables to check
const TABLES_TO_CHECK = [
  'LearnerSessions',
  'FrictionEvents', 
  'StruggleLogs',
  'StudentProfiles',
  'AnalogyCache',
  'ScaffoldCache',
  'ConsentRecords',
  'AuditLog',
  'SecurityAlerts',
  'UserSessions'
];

export const handler = async (
  event: APIGatewayProxyEvent | any, // Can be API Gateway or EventBridge event
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Service Integration Verification started', { 
    requestId: context.awsRequestId,
    eventSource: event.source || 'api-gateway'
  });

  try {
    // Handle EventBridge scheduled events
    if (event.source === 'scheduled-health-check') {
      const result = await performHealthCheck();
      console.log('Scheduled health check completed', { 
        status: JSON.parse(result.body).overallStatus 
      });
      return result;
    }
    
    // Handle API Gateway events
    const action = event.pathParameters?.action || 'health-check';
    
    switch (action) {
      case 'health-check':
        return await performHealthCheck();
      case 'detailed-check':
        return await performDetailedCheck();
      case 'recovery-test':
        return await performRecoveryTest();
      default:
        return createResponse(400, { error: 'Invalid action specified' });
    }
  } catch (error) {
    console.error('Service integration verification failed:', error);
    await sendAlert('CRITICAL', 'Service Integration Verification Failed', error);
    
    return createResponse(500, {
      error: 'Service integration verification failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

async function performHealthCheck(): Promise<APIGatewayProxyResult> {
  const services: ServiceHealthCheck[] = [];
  
  // Check AWS Bedrock integration
  services.push(await checkBedrockHealth());
  
  // Check DynamoDB tables
  for (const tableName of TABLES_TO_CHECK) {
    services.push(await checkDynamoDBHealth(tableName));
  }
  
  // Check S3 bucket
  services.push(await checkS3Health());
  
  // Check Bhashini API
  services.push(await checkBhashiniHealth());
  
  // Check GitHub API (basic connectivity)
  services.push(await checkGitHubHealth());
  
  // Determine overall status
  const unhealthyServices = services.filter(s => s.status === 'unhealthy');
  const degradedServices = services.filter(s => s.status === 'degraded');
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (unhealthyServices.length > 0) {
    overallStatus = 'unhealthy';
  } else if (degradedServices.length > 0) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }
  
  const result: IntegrationVerificationResult = {
    overallStatus,
    services,
    timestamp: Date.now(),
    recommendations: generateRecommendations(services)
  };
  
  // Send metrics to CloudWatch
  await sendMetrics(result);
  
  // Send alerts if needed
  if (overallStatus !== 'healthy') {
    await sendAlert(
      overallStatus === 'unhealthy' ? 'HIGH' : 'MEDIUM',
      `Service Health Check: ${overallStatus.toUpperCase()}`,
      result
    );
  }
  
  const responseCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 206 : 503;
  
  return createResponse(responseCode, result);
}

async function checkBedrockHealth(): Promise<ServiceHealthCheck> {
  const startTime = Date.now();
  
  try {
    // Test Bedrock with a simple prompt
    const testPrompt = 'Human: Test health check. Respond with "OK".\n\nAssistant:';
    
    const command = new InvokeModelCommand({
      modelId: CLAUDE_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt: testPrompt,
        max_tokens_to_sample: 10,
        temperature: 0.1,
        top_p: 0.9,
      }),
    });
    
    const response = await bedrockClient.send(command);
    const responseTime = Date.now() - startTime;
    
    if (response.body) {
      const result = JSON.parse(new TextDecoder().decode(response.body));
      
      return {
        serviceName: 'AWS Bedrock (Claude 3 Haiku)',
        status: responseTime < 5000 ? 'healthy' : 'degraded',
        responseTime,
        lastChecked: Date.now(),
        details: {
          modelId: CLAUDE_MODEL_ID,
          responseLength: result.completion?.length || 0
        }
      };
    } else {
      throw new Error('No response body from Bedrock');
    }
  } catch (error) {
    return {
      serviceName: 'AWS Bedrock (Claude 3 Haiku)',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastChecked: Date.now(),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      details: { modelId: CLAUDE_MODEL_ID }
    };
  }
}

async function checkDynamoDBHealth(tableName: string): Promise<ServiceHealthCheck> {
  const startTime = Date.now();
  
  try {
    const command = new DescribeTableCommand({ TableName: tableName });
    const response = await dynamoClient.send(command);
    const responseTime = Date.now() - startTime;
    
    const tableStatus = response.Table?.TableStatus;
    const isHealthy = tableStatus === 'ACTIVE';
    
    return {
      serviceName: `DynamoDB Table: ${tableName}`,
      status: isHealthy ? (responseTime < 1000 ? 'healthy' : 'degraded') : 'unhealthy',
      responseTime,
      lastChecked: Date.now(),
      details: {
        tableStatus,
        itemCount: response.Table?.ItemCount,
        tableSizeBytes: response.Table?.TableSizeBytes
      }
    };
  } catch (error) {
    return {
      serviceName: `DynamoDB Table: ${tableName}`,
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastChecked: Date.now(),
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkS3Health(): Promise<ServiceHealthCheck> {
  const startTime = Date.now();
  
  try {
    const command = new HeadBucketCommand({ Bucket: AUDIO_STORAGE_BUCKET });
    await s3Client.send(command);
    const responseTime = Date.now() - startTime;
    
    return {
      serviceName: 'S3 Audio Storage',
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      responseTime,
      lastChecked: Date.now(),
      details: { bucketName: AUDIO_STORAGE_BUCKET }
    };
  } catch (error) {
    return {
      serviceName: 'S3 Audio Storage',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastChecked: Date.now(),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      details: { bucketName: AUDIO_STORAGE_BUCKET }
    };
  }
}

async function checkBhashiniHealth(): Promise<ServiceHealthCheck> {
  const startTime = Date.now();
  
  try {
    // Test Bhashini API connectivity
    const response = await axios.get(`${BHASHINI_BASE_URL}/health`, {
      timeout: 5000,
      headers: {
        'Authorization': `Bearer ${BHASHINI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    return {
      serviceName: 'Bhashini API',
      status: response.status === 200 ? (responseTime < 3000 ? 'healthy' : 'degraded') : 'unhealthy',
      responseTime,
      lastChecked: Date.now(),
      details: {
        statusCode: response.status,
        baseUrl: BHASHINI_BASE_URL
      }
    };
  } catch (error) {
    // Bhashini might not have a health endpoint, so we'll try a basic service check
    try {
      const response = await axios.get(BHASHINI_BASE_URL, {
        timeout: 5000,
        headers: {
          'Authorization': `Bearer ${BHASHINI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        serviceName: 'Bhashini API',
        status: responseTime < 3000 ? 'degraded' : 'unhealthy',
        responseTime,
        lastChecked: Date.now(),
        details: {
          statusCode: response.status,
          baseUrl: BHASHINI_BASE_URL,
          note: 'Health endpoint not available, tested base URL'
        }
      };
    } catch (secondError) {
      return {
        serviceName: 'Bhashini API',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: Date.now(),
        errorMessage: secondError instanceof Error ? secondError.message : 'Unknown error',
        details: { baseUrl: BHASHINI_BASE_URL }
      };
    }
  }
}

async function checkGitHubHealth(): Promise<ServiceHealthCheck> {
  const startTime = Date.now();
  
  try {
    // Check GitHub API status
    const response = await axios.get('https://api.github.com/status', {
      timeout: 5000
    });
    
    const responseTime = Date.now() - startTime;
    
    return {
      serviceName: 'GitHub API',
      status: response.status === 200 ? (responseTime < 2000 ? 'healthy' : 'degraded') : 'unhealthy',
      responseTime,
      lastChecked: Date.now(),
      details: {
        statusCode: response.status,
        githubStatus: response.data
      }
    };
  } catch (error) {
    return {
      serviceName: 'GitHub API',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastChecked: Date.now(),
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function performDetailedCheck(): Promise<APIGatewayProxyResult> {
  // Perform more comprehensive checks including:
  // - Model response quality tests
  // - Database query performance tests
  // - Audio processing pipeline tests
  // - End-to-end workflow tests
  
  const detailedResults = {
    basicHealthCheck: await performHealthCheck(),
    performanceTests: await runPerformanceTests(),
    integrationTests: await runIntegrationTests(),
    timestamp: Date.now()
  };
  
  return createResponse(200, detailedResults);
}

async function runPerformanceTests() {
  // Test response times under load
  const tests = [];
  
  // Test Bedrock response time with complex prompt
  const complexPromptTest = await testBedrockPerformance();
  tests.push(complexPromptTest);
  
  // Test DynamoDB query performance
  const dbPerformanceTest = await testDatabasePerformance();
  tests.push(dbPerformanceTest);
  
  return {
    tests,
    summary: {
      averageResponseTime: tests.reduce((sum, test) => sum + test.responseTime, 0) / tests.length,
      passedTests: tests.filter(test => test.passed).length,
      totalTests: tests.length
    }
  };
}

async function testBedrockPerformance() {
  const startTime = Date.now();
  
  try {
    const complexPrompt = `Human: Explain the concept of recursion in programming using a cultural analogy from Indian context. Make it suitable for a beginner student.
Assistant:`;
    
    const command = new InvokeModelCommand({
      modelId: CLAUDE_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt: complexPrompt,
        max_tokens_to_sample: 300,
        temperature: 0.7,
        top_p: 0.9,
      }),
    });
    
    const response = await bedrockClient.send(command);
    const responseTime = Date.now() - startTime;
    
    return {
      testName: 'Bedrock Complex Prompt Performance',
      responseTime,
      passed: responseTime < 10000, // Should respond within 10 seconds
      details: {
        modelId: CLAUDE_MODEL_ID,
        promptLength: complexPrompt.length,
        responseLength: response.body ? JSON.parse(new TextDecoder().decode(response.body)).completion?.length : 0
      }
    };
  } catch (error) {
    return {
      testName: 'Bedrock Complex Prompt Performance',
      responseTime: Date.now() - startTime,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function testDatabasePerformance() {
  const startTime = Date.now();
  
  try {
    // Test multiple table descriptions in parallel
    const tablePromises = TABLES_TO_CHECK.slice(0, 3).map(tableName => 
      dynamoClient.send(new DescribeTableCommand({ TableName: tableName }))
    );
    
    await Promise.all(tablePromises);
    const responseTime = Date.now() - startTime;
    
    return {
      testName: 'DynamoDB Parallel Query Performance',
      responseTime,
      passed: responseTime < 3000, // Should complete within 3 seconds
      details: {
        tablesQueried: TABLES_TO_CHECK.slice(0, 3).length
      }
    };
  } catch (error) {
    return {
      testName: 'DynamoDB Parallel Query Performance',
      responseTime: Date.now() - startTime,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function runIntegrationTests() {
  // Test end-to-end workflows
  const tests = [];
  
  // Test Socratic Engine workflow simulation
  const socraticTest = await testSocraticWorkflow();
  tests.push(socraticTest);
  
  // Test Voice Viva workflow simulation
  const voiceVivaTest = await testVoiceVivaWorkflow();
  tests.push(voiceVivaTest);
  
  return {
    tests,
    summary: {
      passedTests: tests.filter(test => test.passed).length,
      totalTests: tests.length
    }
  };
}

async function testSocraticWorkflow() {
  const startTime = Date.now();
  
  try {
    // Simulate a Socratic Engine request
    const testPrompt = `Human: I need help understanding loops in Python. Can you guide me with questions instead of giving me the answer directly?
Assistant:`;
    
    const command = new InvokeModelCommand({
      modelId: CLAUDE_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt: testPrompt,
        max_tokens_to_sample: 200,
        temperature: 0.7,
        top_p: 0.9,
      }),
    });
    
    const response = await bedrockClient.send(command);
    const responseTime = Date.now() - startTime;
    
    if (response.body) {
      const result = JSON.parse(new TextDecoder().decode(response.body));
      const responseText = result.completion || '';
      
      // Check if response contains questions (Socratic method)
      const hasQuestions = responseText.includes('?');
      const avoidsDirectAnswer = !responseText.toLowerCase().includes('for loop') || 
                                !responseText.toLowerCase().includes('while loop');
      
      return {
        testName: 'Socratic Engine Workflow Simulation',
        responseTime,
        passed: hasQuestions && avoidsDirectAnswer && responseTime < 8000,
        details: {
          hasQuestions,
          avoidsDirectAnswer,
          responseLength: responseText.length
        }
      };
    } else {
      throw new Error('No response from Bedrock');
    }
  } catch (error) {
    return {
      testName: 'Socratic Engine Workflow Simulation',
      responseTime: Date.now() - startTime,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function testVoiceVivaWorkflow() {
  const startTime = Date.now();
  
  try {
    // Simulate Voice Viva question generation
    const testPrompt = `Human: Generate 3 conceptual questions about Python functions for a voice viva examination. The questions should test understanding, not memorization.
Assistant:`;
    
    const command = new InvokeModelCommand({
      modelId: CLAUDE_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt: testPrompt,
        max_tokens_to_sample: 300,
        temperature: 0.8,
        top_p: 0.9,
      }),
    });
    
    const response = await bedrockClient.send(command);
    const responseTime = Date.now() - startTime;
    
    if (response.body) {
      const result = JSON.parse(new TextDecoder().decode(response.body));
      const responseText = result.completion || '';
      
      // Check if response contains multiple questions
      const questionCount = (responseText.match(/\?/g) || []).length;
      const hasConceptualWords = responseText.toLowerCase().includes('why') || 
                                 responseText.toLowerCase().includes('how') ||
                                 responseText.toLowerCase().includes('explain');
      
      return {
        testName: 'Voice Viva Workflow Simulation',
        responseTime,
        passed: questionCount >= 3 && hasConceptualWords && responseTime < 10000,
        details: {
          questionCount,
          hasConceptualWords,
          responseLength: responseText.length
        }
      };
    } else {
      throw new Error('No response from Bedrock');
    }
  } catch (error) {
    return {
      testName: 'Voice Viva Workflow Simulation',
      responseTime: Date.now() - startTime,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function performRecoveryTest(): Promise<APIGatewayProxyResult> {
  // Test graceful degradation and recovery mechanisms
  const recoveryTests = [];
  
  // Test Bedrock fallback behavior
  const bedrockRecovery = await testBedrockRecovery();
  recoveryTests.push(bedrockRecovery);
  
  // Test Bhashini fallback behavior
  const bhashiniRecovery = await testBhashiniRecovery();
  recoveryTests.push(bhashiniRecovery);
  
  // Test database connection recovery
  const dbRecovery = await testDatabaseRecovery();
  recoveryTests.push(dbRecovery);
  
  const result = {
    recoveryTests,
    summary: {
      passedTests: recoveryTests.filter(test => test.passed).length,
      totalTests: recoveryTests.length,
      overallRecoveryHealth: recoveryTests.every(test => test.passed) ? 'excellent' : 
                            recoveryTests.some(test => test.passed) ? 'partial' : 'poor'
    },
    timestamp: Date.now()
  };
  
  return createResponse(200, result);
}

async function testBedrockRecovery() {
  try {
    // Test with invalid model ID to trigger error handling
    const command = new InvokeModelCommand({
      modelId: 'invalid-model-id',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt: 'Test prompt',
        max_tokens_to_sample: 10,
      }),
    });
    
    await bedrockClient.send(command);
    
    return {
      testName: 'Bedrock Error Recovery',
      passed: false,
      details: 'Expected error but request succeeded'
    };
  } catch (error) {
    // This is expected - now test if we can recover with valid model
    try {
      const recoveryCommand = new InvokeModelCommand({
        modelId: CLAUDE_MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          prompt: 'Human: Recovery test\n\nAssistant:',
          max_tokens_to_sample: 10,
        }),
      });
      
      await bedrockClient.send(recoveryCommand);
      
      return {
        testName: 'Bedrock Error Recovery',
        passed: true,
        details: 'Successfully recovered from error and made valid request'
      };
    } catch (recoveryError) {
      return {
        testName: 'Bedrock Error Recovery',
        passed: false,
        details: 'Failed to recover from error',
        error: recoveryError instanceof Error ? recoveryError.message : 'Unknown error'
      };
    }
  }
}

async function testBhashiniRecovery() {
  try {
    // Test with invalid endpoint to trigger error
    await axios.get(`${BHASHINI_BASE_URL}/invalid-endpoint`, {
      timeout: 2000,
      headers: {
        'Authorization': `Bearer ${BHASHINI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      testName: 'Bhashini API Recovery',
      passed: false,
      details: 'Expected error but request succeeded'
    };
  } catch (error) {
    // Expected error - now test basic connectivity recovery
    try {
      await axios.get(BHASHINI_BASE_URL, {
        timeout: 3000,
        headers: {
          'Authorization': `Bearer ${BHASHINI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      return {
        testName: 'Bhashini API Recovery',
        passed: true,
        details: 'Successfully recovered and established basic connectivity'
      };
    } catch (recoveryError) {
      return {
        testName: 'Bhashini API Recovery',
        passed: false,
        details: 'Failed to recover connectivity',
        error: recoveryError instanceof Error ? recoveryError.message : 'Unknown error'
      };
    }
  }
}

async function testDatabaseRecovery() {
  try {
    // Test with invalid table name to trigger error
    const command = new DescribeTableCommand({ TableName: 'NonExistentTable' });
    await dynamoClient.send(command);
    
    return {
      testName: 'Database Connection Recovery',
      passed: false,
      details: 'Expected error but request succeeded'
    };
  } catch (error) {
    // Expected error - now test recovery with valid table
    try {
      const recoveryCommand = new DescribeTableCommand({ TableName: TABLES_TO_CHECK[0] });
      await dynamoClient.send(recoveryCommand);
      
      return {
        testName: 'Database Connection Recovery',
        passed: true,
        details: 'Successfully recovered and connected to valid table'
      };
    } catch (recoveryError) {
      return {
        testName: 'Database Connection Recovery',
        passed: false,
        details: 'Failed to recover database connection',
        error: recoveryError instanceof Error ? recoveryError.message : 'Unknown error'
      };
    }
  }
}

function generateRecommendations(services: ServiceHealthCheck[]): string[] {
  const recommendations: string[] = [];
  
  const unhealthyServices = services.filter(s => s.status === 'unhealthy');
  const degradedServices = services.filter(s => s.status === 'degraded');
  
  if (unhealthyServices.length > 0) {
    recommendations.push(`URGENT: ${unhealthyServices.length} service(s) are unhealthy and require immediate attention`);
    unhealthyServices.forEach(service => {
      recommendations.push(`- Fix ${service.serviceName}: ${service.errorMessage || 'Service unavailable'}`);
    });
  }
  
  if (degradedServices.length > 0) {
    recommendations.push(`WARNING: ${degradedServices.length} service(s) are experiencing degraded performance`);
    degradedServices.forEach(service => {
      if (service.responseTime > 5000) {
        recommendations.push(`- Optimize ${service.serviceName}: Response time ${service.responseTime}ms exceeds threshold`);
      }
    });
  }
  
  // Specific recommendations based on service types
  const bedrockService = services.find(s => s.serviceName.includes('Bedrock'));
  if (bedrockService && bedrockService.status !== 'healthy') {
    recommendations.push('- Consider implementing Bedrock request caching to reduce load');
    recommendations.push('- Review Bedrock model quotas and request patterns');
  }
  
  const bhashiniService = services.find(s => s.serviceName.includes('Bhashini'));
  if (bhashiniService && bhashiniService.status !== 'healthy') {
    recommendations.push('- Implement offline language processing fallback for Bhashini API failures');
    recommendations.push('- Consider caching common translations to reduce API dependency');
  }
  
  const dbServices = services.filter(s => s.serviceName.includes('DynamoDB'));
  const unhealthyDbServices = dbServices.filter(s => s.status === 'unhealthy');
  if (unhealthyDbServices.length > 0) {
    recommendations.push('- Check DynamoDB table configurations and IAM permissions');
    recommendations.push('- Review DynamoDB capacity settings and scaling policies');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('All services are healthy - no immediate action required');
    recommendations.push('Continue monitoring service performance and response times');
  }
  
  return recommendations;
}

async function sendMetrics(result: IntegrationVerificationResult): Promise<void> {
  try {
    const metricData: any[] = [
      {
        MetricName: 'ServiceHealthOverall',
        Value: result.overallStatus === 'healthy' ? 1 : result.overallStatus === 'degraded' ? 0.5 : 0,
        Unit: 'None',
        Dimensions: [
          {
            Name: 'Environment',
            Value: 'Production'
          }
        ]
      },
      {
        MetricName: 'HealthyServicesCount',
        Value: result.services.filter(s => s.status === 'healthy').length,
        Unit: 'Count',
        Dimensions: [
          {
            Name: 'Environment',
            Value: 'Production'
          }
        ]
      },
      {
        MetricName: 'UnhealthyServicesCount',
        Value: result.services.filter(s => s.status === 'unhealthy').length,
        Unit: 'Count',
        Dimensions: [
          {
            Name: 'Environment',
            Value: 'Production'
          }
        ]
      }
    ];
    
    // Add individual service metrics
    result.services.forEach(service => {
      metricData.push({
        MetricName: 'ServiceResponseTime',
        Value: service.responseTime,
        Unit: 'Milliseconds',
        Dimensions: [
          {
            Name: 'ServiceName',
            Value: service.serviceName
          },
          {
            Name: 'Environment',
            Value: 'Production'
          }
        ]
      });
      
      metricData.push({
        MetricName: 'ServiceHealth',
        Value: service.status === 'healthy' ? 1 : service.status === 'degraded' ? 0.5 : 0,
        Unit: 'None',
        Dimensions: [
          {
            Name: 'ServiceName',
            Value: service.serviceName
          },
          {
            Name: 'Environment',
            Value: 'Production'
          }
        ]
      });
    });
    
    const command = new PutMetricDataCommand({
      Namespace: 'SutraCode/ServiceIntegration',
      MetricData: metricData
    });
    
    await cloudWatchClient.send(command);
    console.log('Metrics sent to CloudWatch successfully');
  } catch (error) {
    console.error('Failed to send metrics to CloudWatch:', error);
  }
}

async function sendAlert(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', subject: string, details: any): Promise<void> {
  try {
    const message = {
      severity,
      subject,
      details,
      timestamp: new Date().toISOString(),
      service: 'Sutra-Code Service Integration Verifier'
    };
    
    const command = new PublishCommand({
      TopicArn: ALERT_TOPIC_ARN,
      Subject: `[${severity}] Sutra-Code: ${subject}`,
      Message: JSON.stringify(message, null, 2)
    });
    
    await snsClient.send(command);
    console.log(`Alert sent: ${severity} - ${subject}`);
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
}

function createResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    },
    body: JSON.stringify(body, null, 2)
  };
}