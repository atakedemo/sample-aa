import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as albv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';

export class ApiGateway extends Construct {
    public readonly cluster: ecs.Cluster;
    
    constructor(
        scope: Construct, 
        id: string,
        albGeth: albv2.ApplicationLoadBalancer,
        albRpc: albv2.ApplicationLoadBalancer,
    ) {
        super(scope, id);

        // --------------------
        // API Gateway
        // --------------------
        const api = new apigateway.RestApi(this, 'ApiGwAA', {
            restApiName: 'RestApiBundler',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
            },
        });

        // Api for Geth-Node
        const integrationGeth = new apigateway.HttpIntegration(`http://${albGeth.loadBalancerDnsName}`, {
            httpMethod: 'POST',
            proxy: true,
        });
        const resourceGeth = api.root.addResource('geth');
        resourceGeth.addMethod('POST', integrationGeth);

        // Api for Rpc
        const integrationRpc = new apigateway.HttpIntegration(`http://${albRpc.loadBalancerDnsName}`, {
            httpMethod: 'POST',
            proxy: true,
        });
        const resourceRpc = api.root.addResource('rpc');
        resourceRpc.addMethod('POST', integrationRpc);

        const deployment = new apigateway.Deployment(this, 'ApiDeployment', {
            api,
        });
        const stage = new apigateway.Stage(this, 'ApiStage', {
            deployment,
            stageName: 'demo',
          });
      
        api.deploymentStage = stage;
    }
}