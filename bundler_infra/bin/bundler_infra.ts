#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BundlerBackendStack } from '../lib/bundler_infra-stack';

const app = new cdk.App();
new BundlerBackendStack(app, 'BundlerInfraStack', {
  repositoryArn: 'sss',
  repositoryName: 'sss',
});