import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from 'aws-cdk-lib/aws-iam';

export class EcsContainer extends Construct {
    public readonly cluster: ecs.Cluster;
    public readonly taskDefinition: ecs.Ec2TaskDefinition;
    
    constructor(
        scope: Construct, 
        id: string, 
        vpc: ec2.Vpc,
        repositoryUriGeth: string,
        repositoryUriRundler: string,
    ) {
        super(scope, id);

        // ECS Cluster
        this.cluster = new ecs.Cluster(this, "EcsCluster", {
            clusterName: `aa-demo-bundler-server`,
            vpc: vpc,
        });
    
        this.taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef', {
            networkMode: ecs.NetworkMode.BRIDGE,
        });
        
        // Container | Geth
        const container = this.taskDefinition.addContainer('GethContainer', {
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
                '--miner.gaslimit=12000000',
                '--http',
                '--http.api=personal,eth,net,web3,debug',
                '--http.vhosts=*',
                '--http.addr=0.0.0.0',
                '--ws',
                '--ws.api=personal,eth,net,web3,debug',
                '--ws.addr=0.0.0.0',
                '--ignore-legacy-receipts',
                '--allow-insecure-unlock',
                '--dev',
                '--verbosity=2',
                '--nodiscover',
                '--maxpeers=0',
                '--mine',
                '--miner.threads=1',
                '--networkid=1337',
                '--datadir=/data',
            ],
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'geth',
            }),
        })

        this.taskDefinition.addVolume({
            name: 'RootVolume',
            host: {
                sourcePath: '/data',
            },
        });

       container.addMountPoints({
            sourceVolume: 'RootVolume',
            containerPath: '/data',
            readOnly: false,
        });

        // Container | Rundler(RPC)
        // this.taskDefinition.addContainer('GethContainer', {
        //     image: ecs.ContainerImage.fromRegistry('ethereum/client-go:v1.10.26'),
        //     memoryReservationMiB: 512,
        //     cpu: 256,
        //     portMappings: [
        //         { containerPort: 8546 },
        //         { containerPort: 8546 }
        //     ],
        //     command: [

        //     ]
        // })
    }
}