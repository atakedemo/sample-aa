import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as albv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export class Ec2Service extends Construct {
    constructor(
        scope: Construct, 
        id: string, 
        ec2Role: iam.Role, 
        vpc: ec2.Vpc,
        cluster: ecs.Cluster,
        taskDefinition: ecs.Ec2TaskDefinition,
    ) {
        super(scope, id);
        
        // --------------------
        // Security Group
        // --------------------
        const sgEc2 = new ec2.SecurityGroup(this, 'SecurityGroupCluster', {
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
            ec2.Port.tcp(8545),
            'allow Geth traffic from anywhere',
        );
        sgEc2.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(8546),
            'allow Geth traffic from anywhere',
        );

        // --------------------
        // EC2
        // --------------------
        cluster.addCapacity('DefaultAutoScalingGroup', {
            instanceType: new ec2.InstanceType('t3.xlarge'),
            machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
            blockDevices: [
                {
                  deviceName: '/dev/xvda',
                  volume: autoscaling.BlockDeviceVolume.ebs(500),
                },
            ],
        })

        const ec2Service = new ecs.Ec2Service(this, 'Ec2Service', {
            cluster,
            taskDefinition,
            // securityGroups: [sgEc2]
        });

        const alb = new albv2.ApplicationLoadBalancer(this, 'GethAlb', {
            vpc,
            internetFacing: true,
        });

        const listener = alb.addListener('GethListener', {
            port: 80,
            protocol: albv2.ApplicationProtocol.HTTP,
          });
          
        listener.addTargets('GethTargets', {
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
    }
}