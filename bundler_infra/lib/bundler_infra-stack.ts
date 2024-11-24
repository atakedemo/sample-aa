import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc } from './constract/01_Vpc';
import { KmsAndIam } from './constract/02_KmsAndIam';
import { EcsContainer } from './constract/03_EcsContainer';
import { Ec2Service } from './constract/04_Ec2Service'; 

interface BundlerBackendStackProps extends cdk.StackProps {
  repositoryArn: string,
  repositoryName: string
}

export class BundlerBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: BundlerBackendStackProps) {
    super(scope, id, props);
    
    const vpcConst = new Vpc(this, "Vpc");
    const kmsiamConst = new KmsAndIam(this, "KmsAndIam");

    const ecsContainerConst = new EcsContainer(
      this, 
      "EcsContainer", 
      vpcConst.vpc,
      props?.repositoryArn as string,
      props?.repositoryName as string,
    );

    new Ec2Service(
      this, 
      "Ec2Service", 
      kmsiamConst.ec2Role, 
      vpcConst.vpc,
      ecsContainerConst.cluster,
      ecsContainerConst.taskDefinition,
    );
  }
}
