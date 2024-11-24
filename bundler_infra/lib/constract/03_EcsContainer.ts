import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";

export class EcsContainer extends Construct {
    public readonly cluster: ecs.Cluster;
    public readonly taskDefinition: ecs.Ec2TaskDefinition;
    
    constructor(
        scope: Construct, 
        id: string, 
        vpc: ec2.Vpc,
        repositoryArn: string,
        repositoryName: string,
    ) {
        super(scope, id);

        // ECS Cluster
        this.cluster = new ecs.Cluster(this, "EcsCluster", {
            clusterName: `aa-demo-ethereum-cosmos`,
            vpc: vpc,
        });
    
        this.taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef', {
            networkMode: ecs.NetworkMode.BRIDGE,
            // taskRole: ecsTaskRole,
        });
        
        // ECS Task-Definition
        this.taskDefinition.addContainer("BundlerResContainer", {
            image: ecs.ContainerImage.fromEcrRepository(
            Repository.fromRepositoryAttributes(this, "EcrRepository", {
                repositoryArn: repositoryArn,
                repositoryName: repositoryName,
            })
            ),
            cpu: 512,
            memoryLimitMiB: 2048,
            portMappings: [
                { containerPort: 80 },
                { containerPort: 443 }
            ],
            logging: new ecs.AwsLogDriver({
                streamPrefix: "BundlerRes",
                mode: ecs.AwsLogDriverMode.NON_BLOCKING,
            }),
            privileged: true
        });
    }
}