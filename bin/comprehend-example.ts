#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ComprehendExampleStack } from '../lib/comprehend-example-stack';

const app = new cdk.App();
new ComprehendExampleStack(app, 'ComprehendExampleStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION
  }
});