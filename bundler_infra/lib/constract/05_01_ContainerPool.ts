import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as albv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from "aws-cdk-lib/aws-iam";

export class EcsContainerPool extends Construct {
    public readonly alb: albv2.ApplicationLoadBalancer;
    public readonly ec2instance: ec2.Instance;

    constructor(
        scope: Construct, 
        id: string,
        vpc: ec2.Vpc,
        cluster: ecs.Cluster,
        albPool: albv2.ApplicationLoadBalancer,
        repositoryUriRundler: string,
    ) {
        super(scope, id);

        // --------------------
        // Security Group
        // --------------------
        const sgEc2 = new ec2.SecurityGroup(this, 'sgContinaerRundler', {
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
            'allow traffic from builder/rpc',
        );

        sgEc2.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(8080),
            'allow traffic from builder/rpc',
        );
        sgEc2.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(8545),
            'allow Rundler traffic from anywhere',
        );
        sgEc2.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(8546),
            'allow Rundler traffic from anywhere',
        );


        // --------------------
        // IAM
        // --------------------
        const taskExecutionRole = new iam.Role(this, 'EcsExecutionRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });
        taskExecutionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'));
        
        const taskRole = new iam.Role(this, 'EcsTaskRole', {
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
        // ECS Setting (Rundler-Pool)
        // ------------------------------
        // Task-Definition
        const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDefRundler', {
            networkMode: ecs.NetworkMode.BRIDGE,
            taskRole: taskRole,
            executionRole: taskExecutionRole,
        });

        // Container | Rundler-Pool
        const containerPool = taskDefinition.addContainer('ContainerPool', {
            image: ecs.ContainerImage.fromRegistry(repositoryUriRundler),
            memoryReservationMiB: 512,
            cpu: 256,
            portMappings: [
                {
                    containerPort: 50051,
                    protocol: ecs.Protocol.TCP,
                    hostPort: 50051
                }
            ],
            command: ['pool'],
            environment: {
                RUST_LOG: "debug",
                ENTRY_POINTS: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
                NODE_HTTP: "http://" + albPool.loadBalancerDnsName,
                MIN_UNSTAKE_DELAY:"2",
                POOL_HOST: "0.0.0.0",
                NETWORK:"dev"
            },
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'rundler-pool',
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

        new ecs.Ec2Service(this, 'Ec2ServicePool', {
            cluster,
            taskDefinition,
            placementConstraints: [
                ecs.PlacementConstraint.memberOf('ec2InstanceId in ['+ this.ec2instance.instanceId +']'),
            ],
        });

        // --------------------
        // Alb
        // --------------------
        // this.alb = new albv2.ApplicationLoadBalancer(this, 'AlbPool', {
        //     vpc,
        //     internetFacing: false,
        // });

        // const listener = this.alb.addListener('ListenerPool', {
        //     port: 80,
        //     protocol: albv2.ApplicationProtocol.HTTP,
        // });
          
        // listener.addTargets('TargetsPool', {
        //     port: 50051,
        //     protocol: albv2.ApplicationProtocol.HTTP,
        //     targets: [Ec2ServicePool],
        //     healthCheck: {
        //         path: '/',
        //         port: '50051',
        //         protocol: albv2.Protocol.HTTP,
        //         interval: cdk.Duration.seconds(30),
        //         timeout: cdk.Duration.seconds(5),
        //         unhealthyThresholdCount: 2,
        //         healthyThresholdCount: 2,
        //     },
        // });
    }
}