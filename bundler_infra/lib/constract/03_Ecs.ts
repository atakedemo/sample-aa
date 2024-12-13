import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";

export class Ecs extends Construct {
    public readonly cluster: ecs.Cluster;
    
    constructor(
        scope: Construct, 
        id: string,
        vpc: ec2.Vpc,
    ) {
        super(scope, id);

        // ECS Cluster
        this.cluster = new ecs.Cluster(this, "EcsCluster", {
            clusterName: `aa-demo-bundler-geth`,
            vpc: vpc,
        });
    }
}