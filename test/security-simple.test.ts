import { SutraCodeStack } from '../lib/sutra-code-stack';
import * as cdk from 'aws-cdk-lib';

describe('Security Components Simple Test', () => {
  test('should create stack with security components without errors', () => {
    const app = new cdk.App();
    
    // This should not throw any errors
    expect(() => {
      new SutraCodeStack(app, 'TestSutraCodeStack', {
        env: {
          account: '123456789012',
          region: 'ap-south-1',
        },
      });
    }).not.toThrow();
  });

  test('should have security lambda functions defined', () => {
    const app = new cdk.App();
    const stack = new SutraCodeStack(app, 'TestSutraCodeStack', {
      env: {
        account: '123456789012',
        region: 'ap-south-1',
      },
    });

    // Check that security components are defined
    expect(stack.consentManagerLambda).toBeDefined();
    expect(stack.auditLoggerLambda).toBeDefined();
    expect(stack.sessionManagerLambda).toBeDefined();
    expect(stack.encryptionConfig).toBeDefined();
  });

  test('should have security tables defined', () => {
    const app = new cdk.App();
    const stack = new SutraCodeStack(app, 'TestSutraCodeStack', {
      env: {
        account: '123456789012',
        region: 'ap-south-1',
      },
    });

    // Check that security tables are defined
    expect(stack.consentRecordsTable).toBeDefined();
    expect(stack.auditLogTable).toBeDefined();
    expect(stack.securityAlertsTable).toBeDefined();
    expect(stack.userSessionsTable).toBeDefined();
  });

  test('should have encryption keys defined', () => {
    const app = new cdk.App();
    const stack = new SutraCodeStack(app, 'TestSutraCodeStack', {
      env: {
        account: '123456789012',
        region: 'ap-south-1',
      },
    });

    // Check that encryption keys are defined
    expect(stack.encryptionConfig.kmsKey).toBeDefined();
    expect(stack.encryptionConfig.s3EncryptionKey).toBeDefined();
    expect(stack.encryptionConfig.dynamoDbEncryptionKey).toBeDefined();
    expect(stack.encryptionConfig.auditLogKey).toBeDefined();
  });
});