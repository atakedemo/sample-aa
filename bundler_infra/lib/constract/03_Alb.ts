import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from 'constructs';
import * as albv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export class Alb extends Construct {
    public readonly alb: albv2.ApplicationLoadBalancer;

    constructor(
        scope: Construct, 
        id: string,
        vpc: ec2.Vpc,
    ) {
        super(scope, id);

        // ALB
        this.alb = new albv2.ApplicationLoadBalancer(this, 'AlbRundler', {
            vpc,
            internetFacing: true,
        });
    }
}