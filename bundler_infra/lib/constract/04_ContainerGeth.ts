import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as albv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from "aws-cdk-lib/aws-iam";

export class ContainerGeth extends Construct {
    public readonly alb: albv2.ApplicationLoadBalancer;

    constructor(
        scope: Construct, 
        id: string,
        vpc: ec2.Vpc,
        cluster: ecs.Cluster,
        repositoryUriGeth: string,
    ) {
        super(scope, id);

        // --------------------
        // Security Group
        // --------------------
        const sgEc2 = new ec2.SecurityGroup(this, 'sgContinaerGeth', {
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
            ec2.Port.tcp(8545),
            'allow Geth traffic from anywhere',
        );
        sgEc2.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(8546),
            'allow Geth traffic from anywhere',
        );

        const ec2Role = new iam.Role(this, 'Ec2InstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        });
        ec2Role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

        // Task-Definition
        const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDefGeth', {
            networkMode: ecs.NetworkMode.BRIDGE,
        });

        taskDefinition.addVolume({
            name: 'RootVolume',
            host: {
                sourcePath: '/data',
            },
        });

        // Container | Geth
        const container = taskDefinition.addContainer('ContainerGeth', {
            image: ecs.ContainerImage.fromRegistry(repositoryUriGeth),
            memoryReservationMiB: 512,
            cpu: 256,
            portMappings: [
                {
                    containerPort: 8545,
                    protocol: ecs.Protocol.TCP,
                    hostPort: 8545
                }
            ],
            command: [
                '--miner.gaslimit=100000000',
                '--http',
                '--http.api=personal,eth,net,web3,debug',
                '--http.vhosts=*',
                '--http.addr=0.0.0.0',
                '--ws',
                '--ws.api=personal,eth,net,web3,debug',
                '--ws.addr=0.0.0.0',
                '--ignore-legacy-receipts',
                '--allow-insecure-unlock',
                '--rpc.allow-unprotected-txs',
                '--dev',
                '--verbosity=2',
                '--nodiscover',
                '--maxpeers=0',
                '--mine',
                '--miner.threads=1',
                '--networkid=1337',
            ],
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'geth',
            }),
        })

        container.addMountPoints({
            sourceVolume: 'RootVolume',
            containerPath: '/data',
            readOnly: false,
        });

        // --------------------
        // EC2
        // --------------------
        const asg = cluster.addCapacity('AsgGeth', {
            instanceType: new ec2.InstanceType('t3.xlarge'),
            machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
            blockDevices: [
                {
                  deviceName: '/dev/xvda',
                  volume: autoscaling.BlockDeviceVolume.ebs(500),
                },
            ],
        })
        asg.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

        const ec2Service = new ecs.Ec2Service(this, 'Ec2ServiceGeth', {
            cluster,
            taskDefinition,
        });

        // --------------------
        // Alb
        // --------------------
        this.alb = new albv2.ApplicationLoadBalancer(this, 'AlbGeth', {
            vpc,
            internetFacing: true,
        });

        const listener = this.alb.addListener('ListenerGeth', {
            port: 80,
            protocol: albv2.ApplicationProtocol.HTTP,
        });
          
        listener.addTargets('TargetsGeth', {
            port: 8545,
            protocol: albv2.ApplicationProtocol.HTTP,
            targets: [ec2Service],
            healthCheck: {
                path: '/',
                port: '8545',
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