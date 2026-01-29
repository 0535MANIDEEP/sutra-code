#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SutraCodeStack } from '../lib/sutra-code-stack';

const app = new cdk.App();

// Deploy to ap-south-1 (Mumbai) for DPDP Act 2023 compliance
new SutraCodeStack(app, 'SutraCodeStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'ap-south-1', // Mumbai region for Indian data residency
  },
  description: 'Sutra-Code Socratic AI Mentor - Infrastructure for transforming copy-paste engineers into problem-solvers',
  tags: {
    Project: 'SutraCode',
    Environment: 'Production',
    Compliance: 'DPDP-Act-2023',
    Purpose: 'Educational-AI-Platform'
  }
});