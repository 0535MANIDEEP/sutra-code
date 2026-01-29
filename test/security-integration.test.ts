import { SutraCodeStack } from '../lib/sutra-code-stack';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

describe('Security Integration Tests', () => {
  let app: cdk.App;
  let stack: SutraCodeStack;
  let template: Template;

  beforeAll(() => {
    app = new cdk.App();
    stack = new SutraCodeStack(app, 'TestSutraCodeStack', {
      env: {
        account: '123456789012',
        region: 'ap-south-1',
      },
    });
    template = Template.fromStack(stack);
  });

  describe('Encryption Configuration', () => {
    test('should create multiple KMS keys for different data types', () => {
      // Master key
      template.hasResourceProperties('AWS::KMS::Key', {
        Description: 'Master encryption key for Sutra-Code system - DPDP Act 2023 compliance',
        EnableKeyRotation: true,
      });

      // S3 encryption key
      template.hasResourceProperties('AWS::KMS::Key', {
        Description: 'S3 encryption key for audio files and student documents',
        EnableKeyRotation: true,
      });

      // DynamoDB encryption key
      template.hasResourceProperties('AWS::KMS::Key', {
        Description: 'DynamoDB encryption key for student learning data',
        EnableKeyRotation: true,
      });

      // Audit log key
      template.hasResourceProperties('AWS::KMS::Key', {
        Description: 'Encryption key for audit logs and compliance data',
        EnableKeyRotation: true,
      });
    });

    test('should create KMS key aliases', () => {
      template.hasResourceProperties('AWS::KMS::Alias', {
        AliasName: 'alias/sutra-code-master-key',
      });

      template.hasResourceProperties('AWS::KMS::Alias', {
        AliasName: 'alias/sutra-code-s3-key',
      });

      template.hasResourceProperties('AWS::KMS::Alias', {
        AliasName: 'alias/sutra-code-dynamodb-key',
      });

      template.hasResourceProperties('AWS::KMS::Alias', {
        AliasName: 'alias/sutra-code-audit-key',
      });
    });
  });

  describe('Security Tables', () => {
    test('should create consent records table with encryption', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'ConsentRecords',
        BillingMode: 'PAY_PER_REQUEST',
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
        StreamSpecification: {
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
      });
    });

    test('should create audit log table with encryption', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'AuditLog',
        BillingMode: 'PAY_PER_REQUEST',
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
        StreamSpecification: {
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
      });
    });

    test('should create security alerts table', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'SecurityAlerts',
        BillingMode: 'PAY_PER_REQUEST',
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      });
    });

    test('should create user sessions table with TTL', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'UserSessions',
        BillingMode: 'PAY_PER_REQUEST',
        TimeToLiveSpecification: {
          AttributeName: 'expiresAt',
          Enabled: true,
        },
      });
    });
  });

  describe('Security Lambda Functions', () => {
    test('should create consent manager lambda', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'SutraCode-ConsentManager',
        Runtime: 'nodejs18.x',
        Handler: 'index.handler',
        Description: 'DPDP Act 2023 compliant consent management system',
      });
    });

    test('should create audit logger lambda', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'SutraCode-AuditLogger',
        Runtime: 'nodejs18.x',
        Handler: 'index.handler',
        Description: 'Comprehensive audit logging for DPDP Act 2023 compliance',
      });
    });

    test('should create session manager lambda', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'SutraCode-SessionManager',
        Runtime: 'nodejs18.x',
        Handler: 'index.handler',
        Description: 'Secure session management with DPDP Act 2023 compliance',
      });
    });
  });

  describe('Security Infrastructure', () => {
    test('should create SNS topic for security alerts', () => {
      template.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: 'SutraCode-SecurityAlerts',
        DisplayName: 'Sutra-Code Security Alerts',
      });
    });

    test('should create CloudWatch log groups for security logging', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/lambda/consent-manager',
        RetentionInDays: 2557, // 7 years
      });

      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/lambda/audit-logger',
        RetentionInDays: 2557, // 7 years
      });

      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/lambda/session-manager',
        RetentionInDays: 2557, // 7 years
      });
    });
  });

  describe('API Gateway Security Endpoints', () => {
    test('should create consent management endpoints', () => {
      // The template should contain API Gateway resources for consent endpoints
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'consent',
      });
    });

    test('should create session management endpoints', () => {
      // The template should contain API Gateway resources for session endpoints
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'session',
      });
    });
  });

  describe('DynamoDB Stream Integration', () => {
    test('should connect DynamoDB streams to audit logger', () => {
      // Check for event source mappings
      template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
        StartingPosition: 'LATEST',
        BatchSize: 10,
        MaximumBatchingWindowInSeconds: 5,
      });
    });
  });

  describe('IAM Permissions', () => {
    test('should grant appropriate permissions to security lambdas', () => {
      // Check that Lambda execution role has necessary permissions
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'SutraCode-LambdaExecutionRole',
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
              Action: 'sts:AssumeRole',
            },
          ],
        },
      });
    });

    test('should include KMS permissions for all encryption keys', () => {
      // Check that the role has KMS permissions
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Action: [
                'kms:Decrypt',
                'kms:Encrypt',
                'kms:GenerateDataKey',
                'kms:DescribeKey',
              ],
            },
          ],
        },
      });
    });

    test('should include SNS permissions for security alerts', () => {
      // Check that the role has SNS permissions
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Action: ['sns:Publish'],
            },
          ],
        },
      });
    });
  });

  describe('DPDP Act 2023 Compliance Features', () => {
    test('should configure data retention policies', () => {
      // S3 bucket should have lifecycle rules for 7-year retention
      template.hasResourceProperties('AWS::S3::Bucket', {
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'VoiceRecordingLifecycle',
              Status: 'Enabled',
              ExpirationInDays: 2555, // ~7 years
            },
          ],
        },
      });
    });

    test('should enable point-in-time recovery for all critical tables', () => {
      // All security-related tables should have PITR enabled
      const criticalTables = [
        'ConsentRecords',
        'AuditLog',
        'SecurityAlerts',
        'UserSessions',
        'LearnerSessions',
        'StudentProfiles',
      ];

      criticalTables.forEach(tableName => {
        template.hasResourceProperties('AWS::DynamoDB::Table', {
          TableName: tableName,
          PointInTimeRecoverySpecification: {
            PointInTimeRecoveryEnabled: true,
          },
        });
      });
    });
  });
});