#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BundlerBackendStack } from '../lib/bundler_infra-stack';

const app = new cdk.App();
new BundlerBackendStack(app, 'BundlerInfraStack', {
  repositoryUriGeth: 'ethereum/client-go:v1.10.26',
  repositoryUriRundler: '594175341170.dkr.ecr.ap-northeast-1.amazonaws.com/rundler:latest',
});