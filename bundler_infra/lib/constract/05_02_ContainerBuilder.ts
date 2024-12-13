import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as albv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from "aws-cdk-lib/aws-iam";

export class EcsContainerBuilder extends Construct {
    public readonly alb: albv2.ApplicationLoadBalancer;
    public readonly ec2instance: ec2.Instance;

    constructor(
        scope: Construct, 
        id: string,
        vpc: ec2.Vpc,
        cluster: ecs.Cluster,
        albGeth: albv2.ApplicationLoadBalancer,
        ec2Pool: ec2.Instance,
        repositoryUriRundler: string,
    ) {
        super(scope, id);

        // --------------------
        // Security Group
        // --------------------
        const sgEc2 = new ec2.SecurityGroup(this, 'sgContinaerBuilder', {
            vpc,
            description: 'AA Bundler Node',
            allowAllOutbound: true
        });
    
        sgEc2.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(443),
            'allow HTTPS traffic from anywhere',
        );
        sgEc2.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(80),
            'allow HTTP traffic from anywhere',
        );
        sgEc2.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(50051),
            'allow HTTP traffic from anywhere',
        );
        sgEc2.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(50052),
            'allow HTTP traffic from anywhere',
        );
        sgEc2.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(8545),
            'allow Builder traffic from anywhere',
        );
        sgEc2.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(8546),
            'allow Builder traffic from anywhere',
        );

        // --------------------
        // IAM
        // --------------------
        const taskExecutionRole = new iam.Role(this, 'EcsExecBuilder', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });
        taskExecutionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'));
        
        const taskRole = new iam.Role(this, 'EcsTaskRoleBuilder', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });
        taskRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'));

        const instanceRole = new iam.Role(this, 'EcsInstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromManagedPolicyArn(
                    this, `AmazonEC2ContainerServiceforEC2Role-batch`, "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
                ),
                iam.ManagedPolicy.fromManagedPolicyArn(
                    this, `CloudWatchLogsFullAccess-batch`, "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
                )
            ]
        });

        // ------------------------------
        // ECS Setting (Builder-)
        // ------------------------------
        // Task-Definition
        const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDefBuilder', {
            networkMode: ecs.NetworkMode.BRIDGE,
            taskRole: taskRole,
            executionRole: taskExecutionRole,
        });

        // Container | Builder
        const container = taskDefinition.addContainer('ContainerBuilder', {
            image: ecs.ContainerImage.fromRegistry(repositoryUriRundler),
            memoryReservationMiB: 512,
            cpu: 256,
            portMappings: [
                {
                    containerPort: 50052,
                    protocol: ecs.Protocol.TCP,
                    hostPort: 50052
                }
            ],
            command: ['builder'],
            environment: {
                RUST_LOG: "debug",
                ENTRY_POINTS: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
                NODE_HTTP: "http://" + albGeth.loadBalancerDnsName,
                MIN_UNSTAKE_DELAY: "2",
                BUILDER_PRIVATE_KEYS: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80,575f4a2111f4f94160c7cc2b7472bb0b616d8c9d6b0fabdecf44c3c49322b8cd",
                BUILDER_POOL_URL: "http://" + ec2Pool.instancePublicDnsName + ":50051",
                BUILDER_HOST: "0.0.0.0",
                BUILDER_PORT: "50052",
                NETWORK: "dev",
            },
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'rundler-builder',
            }),
        })

        // EC2
        this.ec2instance = new ec2.Instance(this, 'InstancePool', {
            vpc,
            instanceType: new ec2.InstanceType('t3.xlarge'),
            machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
            securityGroup: sgEc2,
            role: instanceRole,
            blockDevices: [
                {
                  deviceName: '/dev/xvda',
                  volume: autoscaling.BlockDeviceVolume.ebs(100),
                },
            ],
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
            },
        });

        this.ec2instance.addUserData(
            `#!/bin/bash`,
            `echo "ECS_CLUSTER=${cluster.clusterName}" >> /etc/ecs/ecs.config`,
            `yum install -y aws-cli`,
        );

        new ecs.Ec2Service(this, 'Ec2ServiceBuilder', {
            cluster,
            taskDefinition,
            placementConstraints: [
                ecs.PlacementConstraint.memberOf('ec2InstanceId in ['+ this.ec2instance.instanceId +']'),
            ],
        });
    }
}