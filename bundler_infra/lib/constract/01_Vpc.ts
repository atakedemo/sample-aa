import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class Vpc extends Construct {
    public readonly vpc: ec2.Vpc;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        // --------------------
        // VPC
        // --------------------
        // Create new VPC with 2 Subnets
        this.vpc = new ec2.Vpc(this, 'VPC', {
            natGateways: 0,
            vpcName: "BundlerVpc",
            subnetConfiguration: [{
            cidrMask: 24,
            name: "Bundler",
            subnetType: ec2.SubnetType.PUBLIC
            }]
        });

        new cdk.CfnOutput(this, "VpcId", {
            value: this.vpc.vpcId,
        });
    }
}