import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export class KmsAndIam extends Construct {
    public readonly ec2Role: iam.Role;

    constructor(scope: Construct, id: string) {
        super(scope, id);
        // --------------------
        // IAM(Role, Policy)
        // --------------------
        const statementDescriptionLogGr = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "logs:DescribeLogGroups"
            ],
            resources: [
                "*"
            ]
        });
    
        const statementSsm = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "ssmmessages:CreateControlChannel",
                "ssmmessages:CreateDataChannel",
                "ssmmessages:OpenControlChannel",
                "ssmmessages:OpenDataChannel"
            ],
            resources: [
                "*"
            ]
        });
    
        // SSMのアクセスを許可するポリシーを追加
        this.ec2Role = new iam.Role(this, 'Ec2InstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        });
        this.ec2Role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));  
    }
}
