import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as iam from 'aws-cdk-lib/aws-iam';

export class Ec2Service extends Construct {
    // public readonly vpc: ec2.Vpc;

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

        // --------------------
        // EC2
        // --------------------
        const instanceType = new ec2.InstanceType('t3.xlarge');
        const autoScalingGroup = new ecs.AsgCapacityProvider(this, 'AaAsgCapacityProvider', {
            autoScalingGroup: new autoscaling.AutoScalingGroup(this, 'AaEcsAsg', {
                vpc,
                vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }),
                instanceType,
                machineImage: ecs.EcsOptimizedImage.amazonLinux2(
                ecs.AmiHardwareType.STANDARD,
                ),
                minCapacity: 1,
                maxCapacity: 1,
                role: ec2Role,
                securityGroup: sgEc2,
                blockDevices: [
                    {
                        deviceName: "/dev/xvda",
                        volume: autoscaling.BlockDeviceVolume.ebs(100),
                    },
                ]
            }),
        });
        const ec2Service = new ecs.Ec2Service(this, 'Ec2Service', {
            cluster,
            taskDefinition,
        });
    }
}