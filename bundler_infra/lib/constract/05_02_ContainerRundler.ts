import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as albv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from "aws-cdk-lib/aws-iam";

export class EcsContainerRundler extends Construct {
    constructor(
        scope: Construct, 
        id: string,
        vpc: ec2.Vpc,
        cluster: ecs.Cluster,
        alb: albv2.ApplicationLoadBalancer,
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

        // --------------------
        // ECS Setting
        // --------------------
        // Task-Definition
        const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDefRundler', {
            networkMode: ecs.NetworkMode.BRIDGE,
            taskRole: taskRole,
            executionRole: taskExecutionRole,
        });

        // Container | Rundler-Pool
        const container = taskDefinition.addContainer('ContainerRundlerPool', {
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
                NODE_HTTP: "http://" + alb.loadBalancerDnsName,
                MIN_UNSTAKE_DELAY:"2",
                POOL_HOST: "0.0.0.0",
                NETWORK:"dev"
            },
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'rundler-pool',
            }),
        })

        // --------------------
        // EC2
        // --------------------
        const asg = cluster.addCapacity('AsgRundlerPool', {
            instanceType: new ec2.InstanceType('t3.xlarge'),
            machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
            blockDevices: [
                {
                  deviceName: '/dev/xvda',
                  volume: autoscaling.BlockDeviceVolume.ebs(100),
                },
            ],
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
            },
        })
        asg.addSecurityGroup(sgEc2);

        const Ec2ServiceRundlerPool = new ecs.Ec2Service(this, 'Ec2ServiceRundler', {
            cluster,
            taskDefinition,
        });
    }
}