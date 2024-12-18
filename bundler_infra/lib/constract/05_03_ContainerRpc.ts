import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as albv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from "aws-cdk-lib/aws-iam";

export class EcsContainerRpc extends Construct {
    public readonly alb: albv2.ApplicationLoadBalancer;
    public readonly ec2instance: ec2.Instance;

    constructor(
        scope: Construct, 
        id: string,
        vpc: ec2.Vpc,
        cluster: ecs.Cluster,
        albGeth: albv2.ApplicationLoadBalancer,
        ec2Pool: ec2.Instance,
        ec2Builder: ec2.Instance,
        repositoryUriRundler: string,
    ) {
        super(scope, id);

        // --------------------
        // Security Group
        // --------------------
        const sgEc2 = new ec2.SecurityGroup(this, 'sgContinaerRpc', {
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
            ec2.Port.tcp(3000),
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
            'allow Rpc traffic from anywhere',
        );
        sgEc2.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(8546),
            'allow Rpc traffic from anywhere',
        );

        // --------------------
        // IAM
        // --------------------
        const taskExecutionRole = new iam.Role(this, 'EcsExecRpc', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });
        taskExecutionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'));
        
        const taskRole = new iam.Role(this, 'EcsTaskRoleRpc', {
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
        // ECS Setting (Rpc-)
        // ------------------------------
        // Task-Definition
        const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDefRpc', {
            networkMode: ecs.NetworkMode.BRIDGE,
            taskRole: taskRole,
            executionRole: taskExecutionRole,
        });

        // Container | Rpc
        const container = taskDefinition.addContainer('ContainerRpc', {
            image: ecs.ContainerImage.fromRegistry(repositoryUriRundler),
            memoryReservationMiB: 512,
            cpu: 256,
            portMappings: [
                {
                    containerPort: 3000,
                    protocol: ecs.Protocol.TCP,
                    hostPort: 3000
                }
            ],
            command: ['rpc'],
            environment: {
                RUST_LOG: "debug",
                ENTRY_POINTS: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
                NODE_HTTP: "http://" + albGeth.loadBalancerDnsName,
                RPC_API: "eth,debug",
                RPC_POOL_URL: "http://" + ec2Pool.instancePublicDnsName + ':50051',
                RPC_BUILDER_URL: "http://" + ec2Builder.instancePublicDnsName + ':50052',
                NETWORK: "dev",
            },
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'rundler-rpc',
            }),
        })

        // EC2
        this.ec2instance = new ec2.Instance(this, 'Instance', {
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

        const Ec2ServiceRpc = new ecs.Ec2Service(this, 'Ec2ServiceRpc', {
            cluster,
            taskDefinition,
        });

        // --------------------
        // Alb
        // --------------------
        this.alb = new albv2.ApplicationLoadBalancer(this, 'AlbRpc', {
            vpc,
            internetFacing: true,
        });

        const listener = this.alb.addListener('ListenerRpc', {
            port: 80,
            protocol: albv2.ApplicationProtocol.HTTP,
        });
          
        listener.addTargets('TargetsRpc', {
            port: 3000,
            protocol: albv2.ApplicationProtocol.HTTP,
            targets: [Ec2ServiceRpc],
            healthCheck: {
                path: '/health',
                port: '3000',
                protocol: albv2.Protocol.HTTP,
                interval: cdk.Duration.seconds(30),
                timeout: cdk.Duration.seconds(5),
                unhealthyThresholdCount: 2,
                healthyThresholdCount: 2,
            },
        });

        listener.setAttribute('routing.http.response.access_control_allow_origin.header_value', '*');
        listener.setAttribute('routing.http.response.access_control_allow_methods.header_value', 'GET,PUT,DELETE,OPTIONS');
        listener.setAttribute('routing.http.response.access_control_allow_headers.header_value', '*');
    }
}