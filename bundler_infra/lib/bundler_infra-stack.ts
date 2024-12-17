import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc } from './constract/01_Vpc';
import { KmsAndIam } from './constract/02_KmsAndIam';
import { Ecs } from './constract/03_Ecs';
import { ContainerGeth } from './constract/04_ContainerGeth';
import { EcsContainerPool } from './constract/05_01_ContainerPool';
import { EcsContainerBuilder } from './constract/05_02_ContainerBuilder';
import { EcsContainerRpc } from './constract/05_03_ContainerRpc';
import { ApiGateway } from './constract/06_ApiGateway';

interface BundlerBackendStackProps extends cdk.StackProps {
  repositoryUriGeth: string,
  repositoryUriRundler: string,
}

export class BundlerBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: BundlerBackendStackProps) {
    super(scope, id, props);
    
    const vpcConst = new Vpc(this, "Vpc");
    const kmsiamConst = new KmsAndIam(this, "KmsAndIam");

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
      props?.repositoryUriGeth as string,
    )

    const containerPool = new EcsContainerPool(
      this, 
      "ContainerRundlerPool",
      vpcConst.vpc,
      ecsRundlerConst.cluster,
      containerGeth.alb,
      props?.repositoryUriRundler as string,
    )

    const containerBuilder = new EcsContainerBuilder(
      this, 
      "ContainerRundlerBuilder",
      vpcConst.vpc,
      ecsRundlerConst.cluster,
      containerGeth.alb,
      containerPool.ec2instance,
      props?.repositoryUriRundler as string,
    )

    const containerRpc = new EcsContainerRpc(
      this, 
      "ContainerRundlerRpc",
      vpcConst.vpc,
      ecsRundlerConst.cluster,
      containerGeth.alb,
      containerPool.ec2instance,
      containerBuilder.ec2instance,
      props?.repositoryUriRundler as string,
    )

    const apiGatewayConst = new ApiGateway(
      this,
      'ApiGatewayRundler',
      containerGeth.alb,
      containerRpc.alb,
    )

    containerPool.node.addDependency(containerGeth);
    containerBuilder.node.addDependency(containerPool);
    containerRpc.node.addDependency(containerBuilder);
  }
}
