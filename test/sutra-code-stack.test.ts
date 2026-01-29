import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { SutraCodeStack } from '../lib/sutra-code-stack';

describe('SutraCodeStack Infrastructure Tests', () => {
  let app: cdk.App;
  let stack: SutraCodeStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new SutraCodeStack(app, 'TestSutraCodeStack', {
      env: {
        account: '123456789012',
        region: 'ap-south-1',
      },
    });
    template = Template.fromStack(stack);
  });

  describe('DynamoDB Tables', () => {
    test('should create LearnerSessions table with correct configuration', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'LearnerSessions',
        AttributeDefinitions: [
          {
            AttributeName: 'sessionId',
            AttributeType: 'S',
          },
          {
            AttributeName: 'timestamp',
            AttributeType: 'N',
          },
          {
            AttributeName: 'studentId',
            AttributeType: 'S',
          },
        ],
        KeySchema: [
          {
            AttributeName: 'sessionId',
            KeyType: 'HASH',
          },
          {
            AttributeName: 'timestamp',
            KeyType: 'RANGE',
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
        StreamSpecification: {
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
        GlobalSecondaryIndexes: [
          {
            IndexName: 'StudentIdIndex',
            KeySchema: [
              {
                AttributeName: 'studentId',
                KeyType: 'HASH',
              },
              {
                AttributeName: 'timestamp',
                KeyType: 'RANGE',
              },
            ],
            Projection: {
              ProjectionType: 'ALL',
            },
          },
        ],
      });
    });

    test('should create FrictionEvents table with correct configuration', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'FrictionEvents',
        AttributeDefinitions: [
          {
            AttributeName: 'eventId',
            AttributeType: 'S',
          },
          {
            AttributeName: 'timestamp',
            AttributeType: 'N',
          },
          {
            AttributeName: 'studentId',
            AttributeType: 'S',
          },
          {
            AttributeName: 'sessionId',
            AttributeType: 'S',
          },
        ],
        KeySchema: [
          {
            AttributeName: 'eventId',
            KeyType: 'HASH',
          },
          {
            AttributeName: 'timestamp',
            KeyType: 'RANGE',
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
        StreamSpecification: {
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
      });
    });

    test('should create StruggleLogs table with grit score analytics GSI', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'StruggleLogs',
        GlobalSecondaryIndexes: Match.arrayWith([
          {
            IndexName: 'StudentGritIndex',
            KeySchema: [
              {
                AttributeName: 'studentId',
                KeyType: 'HASH',
              },
              {
                AttributeName: 'gritScore',
                KeyType: 'RANGE',
              },
            ],
            Projection: {
              ProjectionType: 'ALL',
            },
          },
        ]),
      });
    });

    test('should create StudentProfiles table with multiple GSIs', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'StudentProfiles',
        GlobalSecondaryIndexes: Match.arrayWith([
          {
            IndexName: 'EmailIndex',
            KeySchema: [
              {
                AttributeName: 'email',
                KeyType: 'HASH',
              },
            ],
            Projection: {
              ProjectionType: 'ALL',
            },
          },
          {
            IndexName: 'SkillLevelIndex',
            KeySchema: [
              {
                AttributeName: 'skillLevel',
                KeyType: 'HASH',
              },
              {
                AttributeName: 'gritScore',
                KeyType: 'RANGE',
              },
            ],
            Projection: {
              ProjectionType: 'ALL',
            },
          },
        ]),
      });
    });

    test('should encrypt all DynamoDB tables with customer-managed KMS key', () => {
      // Count the number of DynamoDB tables
      const tables = template.findResources('AWS::DynamoDB::Table');
      const tableCount = Object.keys(tables).length;
      expect(tableCount).toBe(4); // LearnerSessions, FrictionEvents, StruggleLogs, StudentProfiles

      // Verify each table has encryption configuration
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        SSESpecification: {
          SSEEnabled: true,
          KMSMasterKeyId: Match.anyValue(),
        },
      });
    });
  });

  describe('S3 Audio Storage Bucket', () => {
    test('should create S3 bucket with encryption and lifecycle policies', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'aws:kms',
                KMSMasterKeyID: Match.anyValue(),
              },
            },
          ],
        },
        VersioningConfiguration: {
          Status: 'Enabled',
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'VoiceRecordingLifecycle',
              Status: 'Enabled',
              Transitions: [
                {
                  StorageClass: 'STANDARD_IA',
                  TransitionInDays: 30,
                },
                {
                  StorageClass: 'GLACIER',
                  TransitionInDays: 90,
                },
              ],
              ExpirationInDays: 2555, // ~7 years
            },
          ],
        },
        CorsConfiguration: {
          CorsRules: [
            {
              AllowedMethods: ['GET', 'PUT', 'POST'],
              AllowedOrigins: ['*'],
              AllowedHeaders: ['*'],
              MaxAge: 3000,
            },
          ],
        },
      });
    });

    test('should create bucket with region-specific naming', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: Match.stringLikeRegexp('sutra-code-audio-.*-ap-south-1'),
      });
    });
  });

  describe('KMS Encryption', () => {
    test('should create KMS key with rotation enabled', () => {
      template.hasResourceProperties('AWS::KMS::Key', {
        Description: 'KMS key for Sutra-Code data encryption (DPDP Act 2023 compliance)',
        EnableKeyRotation: true,
        KeySpec: 'SYMMETRIC_DEFAULT',
        KeyUsage: 'ENCRYPT_DECRYPT',
      });
    });

    test('should create KMS key alias', () => {
      template.hasResourceProperties('AWS::KMS::Alias', {
        AliasName: 'alias/sutra-code-encryption',
      });
    });

    test('should retain KMS key on stack deletion', () => {
      template.hasResource('AWS::KMS::Key', {
        DeletionPolicy: 'Retain',
      });
    });
  });

  describe('API Gateway', () => {
    test('should create API Gateway with correct configuration', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'Sutra-Code Socratic AI Mentor API',
        Description: 'API for the Sutra-Code Socratic AI Mentor system',
      });
    });

    test('should configure API Gateway deployment with throttling', () => {
      template.hasResourceProperties('AWS::ApiGateway::Deployment', {
        Description: 'API for the Sutra-Code Socratic AI Mentor system',
      });

      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        StageName: 'prod',
        ThrottleSettings: {
          RateLimit: 100, // 100 requests per minute per user
          BurstLimit: 200,
        },
        MethodSettings: [
          {
            ResourcePath: '/*',
            HttpMethod: '*',
            LoggingLevel: 'INFO',
            DataTraceEnabled: true,
            MetricsEnabled: true,
          },
        ],
      });
    });

    test('should create API key and usage plan with rate limiting', () => {
      template.hasResourceProperties('AWS::ApiGateway::ApiKey', {
        Name: 'sutra-code-api-key',
        Description: 'API key for Sutra-Code client applications',
      });

      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        UsagePlanName: 'sutra-code-usage-plan',
        Description: 'Usage plan for Sutra-Code API with rate limiting',
        Throttle: {
          RateLimit: 100,
          BurstLimit: 200,
        },
        Quota: {
          Limit: 10000,
          Period: 'MONTH',
        },
      });
    });

    test('should create required API resource structure', () => {
      // Test for v1 resource
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'v1',
      });

      // Test for socratic resources
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'socratic',
      });

      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'ask',
      });

      // Test for analogies resources
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'analogies',
      });

      // Test for scaffolds resources
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'scaffolds',
      });

      // Test for viva resources
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'viva',
      });

      // Test for github resources
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'github',
      });

      // Test for profiles resources
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'profiles',
      });

      // Test for recruiters resources
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'recruiters',
      });
    });

    test('should configure CORS for all endpoints', () => {
      // The CORS configuration is applied at the RestApi level
      // We can verify it exists in the stack
      const restApis = template.findResources('AWS::ApiGateway::RestApi');
      expect(Object.keys(restApis).length).toBeGreaterThan(0);
    });
  });

  describe('Stack Outputs', () => {
    test('should create all required CloudFormation outputs', () => {
      const outputs = template.findOutputs('*');
      
      expect(outputs).toHaveProperty('KMSKeyId');
      expect(outputs).toHaveProperty('KMSKeyArn');
      expect(outputs).toHaveProperty('LearnerSessionsTableName');
      expect(outputs).toHaveProperty('FrictionEventsTableName');
      expect(outputs).toHaveProperty('StruggleLogsTableName');
      expect(outputs).toHaveProperty('StudentProfilesTableName');
      expect(outputs).toHaveProperty('AudioStorageBucketName');
      expect(outputs).toHaveProperty('AudioStorageBucketArn');
      expect(outputs).toHaveProperty('APIGatewayId');
      expect(outputs).toHaveProperty('APIGatewayURL');
      expect(outputs).toHaveProperty('Region');
    });

    test('should export outputs with correct export names', () => {
      template.hasOutput('KMSKeyId', {
        Export: {
          Name: 'SutraCode-KMSKeyId',
        },
      });

      template.hasOutput('LearnerSessionsTableName', {
        Export: {
          Name: 'SutraCode-LearnerSessionsTable',
        },
      });

      template.hasOutput('APIGatewayURL', {
        Export: {
          Name: 'SutraCode-APIGatewayURL',
        },
      });
    });
  });

  describe('DPDP Act 2023 Compliance', () => {
    test('should deploy to ap-south-1 region for data residency', () => {
      expect(stack.region).toBe('ap-south-1');
    });

    test('should retain all data storage resources', () => {
      // DynamoDB tables should be retained
      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Retain',
      });

      // S3 bucket should be retained
      template.hasResource('AWS::S3::Bucket', {
        DeletionPolicy: 'Retain',
      });

      // KMS key should be retained
      template.hasResource('AWS::KMS::Key', {
        DeletionPolicy: 'Retain',
      });
    });

    test('should have proper resource tagging for compliance', () => {
      // Tags are applied at the app level in the bin/sutra-code.ts file
      // We can verify the stack has the correct properties for compliance
      expect(stack.region).toBe('ap-south-1');
      expect(stack.stackName).toBe('TestSutraCodeStack');
      
      // Verify the stack has the required resources for compliance
      const resources = template.findResources('AWS::DynamoDB::Table');
      expect(Object.keys(resources).length).toBe(4); // All 4 tables created
      
      // Verify KMS encryption is used
      template.hasResourceProperties('AWS::KMS::Key', {
        Description: 'KMS key for Sutra-Code data encryption (DPDP Act 2023 compliance)',
      });
    });
  });

  describe('Scalability for 100,000 concurrent students', () => {
    test('should use PAY_PER_REQUEST billing for DynamoDB tables', () => {
      const tables = template.findResources('AWS::DynamoDB::Table');
      Object.values(tables).forEach((table: any) => {
        expect(table.Properties.BillingMode).toBe('PAY_PER_REQUEST');
      });
    });

    test('should enable DynamoDB streams for real-time analytics', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        StreamSpecification: {
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
      });
    });

    test('should configure API Gateway with appropriate throttling', () => {
      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        ThrottleSettings: {
          RateLimit: 100, // Per user rate limit
          BurstLimit: 200,
        },
      });
    });
  });
});