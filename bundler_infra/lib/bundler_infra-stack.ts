import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc } from './constract/01_Vpc';
import { KmsAndIam } from './constract/02_KmsAndIam';
import { Alb } from './constract/03_Alb';
import { Ecs } from './constract/04_Ecs';
import { ContainerGeth } from './constract/05_01_ContainerGeth';
import { EcsContainerRundler } from './constract/05_02_ContainerRundler';

interface BundlerBackendStackProps extends cdk.StackProps {
  repositoryUriGeth: string,
  repositoryUriRundler: string,
}

export class BundlerBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: BundlerBackendStackProps) {
    super(scope, id, props);
    
    const vpcConst = new Vpc(this, "Vpc");
    const kmsiamConst = new KmsAndIam(this, "KmsAndIam");

    const albConst = new Alb(
      this,
      "AlbRundler",
      vpcConst.vpc
    )

    const ecsRundlerConst = new Ecs(
      this, 
      "EcsRundlerContainer", 
      vpcConst.vpc,
    );

    const containerGeth = new ContainerGeth(
      this, 
      "ContainerGeth",
      vpcConst.vpc,
      ecsRundlerConst.cluster,
      albConst.alb,
      props?.repositoryUriGeth as string,
    )

    new EcsContainerRundler(
      this, 
      "ContainerRundler",
      vpcConst.vpc,
      ecsRundlerConst.cluster,
      albConst.alb,
      props?.repositoryUriRundler as string,
    ).node.addDependency(albConst);
  }
}
