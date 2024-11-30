#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ContainerStack } from '../lib/container-stack';

const app = new cdk.App();
new ContainerStack(app, 'ContainerStack');
