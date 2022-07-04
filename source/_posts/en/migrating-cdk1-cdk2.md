---
title: Migrating from CDK v1 to CDK v2
date: 2022-06-26 19:00:00
lang: en
label: migrating-cdk1-cdk2
tags: 
    - aws
    - cdk
    - python
    - typescript
    - go
    - migration
    - iac
categories: infrastructure-as-code
---
![ ](/images/migration-cdk.jpg)

Not a secret that I've been working with AWS CDK in the last years, taking advantage of making infrastructure as code with common programming languages like python or typescript.

Recently, AWS CDK v1 has entered maintenance mode, which means that no new features or minor fixes will be applied to it, so if you are a regular user of CDK, you very likely will need to move to CDK v2 sooner than later, in case you haven't done it yet.

Migrations are scary many times, so I'm going to talk a bit about the things I've experienced during this amazing journey.

<!-- more -->

As usual, you will find all code examples within [this repository](https://github.com/neovasili/migrating-cdk-v1-to-v2), so you can easily clone it and follow the post from the code.

Let's get started.

## Deployment permissions

How are you deploying your CDK code is quite important at this point. CDK v2 has changed S3 assets bucket name and ECR assets repository name, plus a new SSM parameter that is going to be used by CDK when deploying, so that can be translated into broken deployments after bootstraping you AWS accounts if you don't review the permissions you are granting to your deployment process.

If you are providing `AdministratorAccess` to your deployment roles and wanna continue living in the edge, hey, feel free to skip this section :)  but if you are restricting your deployment permissions at a more fine grained level, you have a couple of options to consider.

Let's assume an scenario where you are deploying your CDK infrastructure using CodeBuild via `cdk deploy` command, so you should have a CodeBuild project with a service role (let's call it _CodeBuild role_) attached. It's also possible that you are using the `--role-arn` option to deploy, thus, you are passing an additional different role to CloudFormation to effectively apply the CloudFormation changes set (let's call it _CloudFormation role_), so you have two different roles involved in your deployment process that you need to review.

The [bootstrapping template](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html#bootstrapping-template) required by CDK v2 provision IAM roles that are used by CDK cli during `cdk diff` and `cdk deploy` actions during the different [phases of a CDK deployment](https://docs.aws.amazon.com/cdk/v2/guide/apps.html#lifecycle).

So **one easy way** to avoid potential problems with deployment permissions is to grant your current CodeBuild role permissions to assume those roles adding the following to your role policies:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AssumeCDKRoles",
            "Effect": "Allow",
            "Action": [
                "sts:AssumeRole"
            ],
            "Resource": [
                "arn:aws:iam::ACCOUNT_ID:role/cdk-*"
            ]
        }
    ]
}
```

If you try to make a CDK v2 deployment with a ser of permissions that does not have those AssumeRole permissions, you will see some messages like this:

```shell
...
current credentials could not be used to assume 'arn:aws:iam::ACCOUNT_ID:role/
cdk-CDK_ID-deploy-role-ACCOUNT_ID-AWS_REGION', but are for the right account. Proceeding anyway.
...
```

That means that CDK is trying to assume those extra new roles, but it can't, so is going to use directly the provided set of permissions, in our scenario, CodeBuild role ones.

**The other option** is continue using the deployment roles you were using for CDK v1.x., thus, not assuming the new roles, but you need to consider the changes explained below.

If your deployment roles are restricting access to S3 assets bucket or to the assets ECR repository by name, you need to be aware that both S3 assets bucket and ECR repository have a different name for CDK v2, so review the roles policies to allow CDK access to both assets resources with the new name.

The naming patterns of the assets resources changes as follows:

- For the S3 assets bucket: from `cdktoolkit-assetsbucket-*` to `cdk-*-assets-*-*`.
- For the ECR assets repository: from `aws-cdk/assets` to `cdk-*-container-assets-*-*`.

If you are using the `--role-arn` option for `cdk diff` or `cdk deploy`, the role that you are passing may also need access to the previously mentioned assets resources depending on the content of your CDK stacks. For example, if you are using `BucketDeployment` or `DockerImageAsset` constructs.

As already mentioned CDK v2 bootstrapping template also includes a new SSM parameter containing the bootstrap version that is also retrieved by CDK during deployments, so as well as with the mentioned assets resources naming changes, you also need to consider to grant extra new permissions for the actions `ssm:GetParameter` and `ssm:GetParameters` to your deployment roles. The name pattern of that SSM parameter is like this: `/cdk-bootstrap/*/version`.

## Use both CDK v1 and v2

Next thing to consider is that you very likely do not want to migrate all stacks at once, so you need to have the ability to operate with both versions at the same time from your machine. The best approach to achieve this, as recommended [in the AWS documentation](https://docs.aws.amazon.com/cdk/v2/guide/migrating-v2.html#work-with-cdk-v2-cli), is using npx and aliasing both versions (in your .bashrc/.zshrc file):

```shell
alias cdk1='npx aws-cdk@1.162.0'
alias cdk='npx aws-cdk@2.30.0'
```

First run of each alias will install the specified strict version.

## Bootstrap CDK v2

Once you have updated your deployment roles to avoid possible broken deployments as explained in the [previous permissions section](#Deployment-permissions), you need to bootstrap those accounts/regions (for CDK this is called [`environment`](https://docs.aws.amazon.com/cdk/v2/guide/environments.html)) where you have your CDK v2 stacks.

That will update the CDKToolkit CloudFormation stack with the new [bootstrapping template](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html#bootstrapping-template) adding some new resources as well as all necessary metadata to allow both CDK versions to work.

< ------- CONTINUE HERE -------- >

## Migrate existing stacks

### Remove feature flags from cdk.json

And add the following ones:

```json
{
  "context": {
        "@aws-cdk/aws-apigateway:usagePlanKeyOrderInsensitiveId": true,
        "@aws-cdk/core:stackRelativeExports": true,
        "@aws-cdk/aws-rds:lowercaseDbIdentifier": true,
        "@aws-cdk/aws-lambda:recognizeVersionProps": true,
        "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
        "@aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021": true,
        "@aws-cdk-containers/ecs-service-extensions:enableDefaultLogDriver": true,
        "@aws-cdk/aws-ec2:uniqueImdsv2TemplateName": true,
        "@aws-cdk/core:checkSecretUsage": true,
        "@aws-cdk/aws-iam:minimizePolicies": true,
        "@aws-cdk/core:target-partitions": [
            "aws",
            "aws-cn"
        ]
    }
}
```

### Updating dependencies and imports

Essentially remove (from dev, peer and general) all `@aws-cdk/aws-*` like dependencies and `@aws-cdk/core` and add the following ones:

```json
{
    "devDependencies": {
        "@types/prettier": "2.6.0",
        "aws-cdk": "2.27.0",
    },
    "dependencies": {
        "aws-cdk-lib": "2.27.0",
        "constructs": "^10.0.0",
    }
}
```

Versions of packages can differ depending on the latest version available.

Remove any lock file and reinstall.

### Migrate imports

Now all imports are from the same dependency with fragments specific per service. Let's say we have something like this:

```typescript
import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as ec2 from '@aws-cdk/aws-ec2';
```

We need to change it for this:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
```

`Construct` is now out of the _core_ package and is required for classes constructors or custom constructs:

```typescript
...
constructor(scope: Construct, id: string, props?: StackProps) {
...
```

### Check constructs compatibility

Some L2/L3 constructs are not ready for the CDK v2, so we might need to do some "magic hacks" to non destructive diffs.

#### MSK cluster L2

From this:

```typescript
const kafkaCluster = new msk.Cluster(this, 'KafkaCluster', {
    clusterName: 'kafka-cluster',
    kafkaVersion: msk.KafkaVersion.V2_8_0,
    vpc,
    vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
    },
    instanceType: new ec2.InstanceType('kafka.m5.large'),
    numberOfBrokerNodes: 1,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    configurationInfo: {
        arn: mskConfig.attrArn,
        revision: 1,
    }
});
```

We need to do this:

```typescript
const kafkaSG = new ec2.SecurityGroup(this, 'KafkaSecurityGroup', {
    description: 'MSK security group',  // Current CFN description
    vpc,
});
const kafkaSgL1 = kafkaSG.node.defaultChild as ec2.CfnSecurityGroup;
kafkaSgL1.overrideLogicalId('KafkaClusterSecurityXXXX');  // Current CFN logical ID

const kafkaCluster = new msk.CfnCluster(this, 'KafkaClusterXXXX', {  // Current CFN logical ID
    clusterName: 'kafka-cluster',
    kafkaVersion: '2.8.0',
    numberOfBrokerNodes: 3,
    configurationInfo: {
        arn: mskConfig.attrArn,
        revision: 1,
    },
    brokerNodeGroupInfo: {
        clientSubnets: vpc.publicSubnets.map((subnet: ec2.ISubnet) => { return subnet.subnetId}),
        instanceType: 'kafka.kafka.m5.large',  // Still trying to guess why this works...
        securityGroups: [kafkaSG.securityGroupId],
        storageInfo: {
                ebsStorageInfo: {
                volumeSize: 1000,
            },
        },
    },
    encryptionInfo: {
        encryptionInTransit: {
            clientBroker: 'TLS',
            inCluster: true,
        },
    },
    loggingInfo: {
        brokerLogs: {
            cloudWatchLogs: {
                enabled: false,
            },
            firehose: {
                enabled: false,
            },
            s3: {
                enabled: false,
            },
        },
    }
});
kafkaCluster.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
new ec2.CfnSecurityGroupIngress(this, 'KafkaClusterSecurityGroupfromOldStackdefaultsgXXXX', {
    ipProtocol: 'tcp',
    description: 'Let me in',
    fromPort: 0,
    toPort: 65535,
    groupId: kafkaSG.securityGroupId,
    sourceSecurityGroupId: defaultSG.securityGroupId,
});
new ec2.CfnSecurityGroupEgress(this, 'defaultsgtoOldStackKafkaClusterSecurityGroupXXXXX', {
    ipProtocol: 'tcp',
    description: 'Let me in',
    fromPort: 0,
    toPort: 65535,
    groupId: defaultSG.securityGroupId,
    destinationSecurityGroupId: kafkaSG.securityGroupId,
});
```

As we can see, moving from a L2/L3 construct to a L1 construct is quite painful and requires a lot of work.

It's important to know that Changes in CloudFormation Logical ID forces replacement of the resource, that's why we are _overriding_ or directly setting up constructs IDs with the existing ones provided by CDK L2 construct (we can find them in the produced CloudFormation template), so that way we avoid the replacement of the resource.

This can be assumed in some cases, like a security group rule, that can cause instant or no outage at all, but can also mean large outages or even worse, data lose when replacing data storage resources, so `we need to be extremely careful` with this, `cdk diff` will be our best ally here.

### Secrets reference

One of the feature flags (see [references](#references) section for more info) recommended by AWS to use in CDK v2 config is `"@aws-cdk/core:checkSecretUsage": true`. Even if you were using it in CDK v1, looks like depending on the version you were using it might not be working as expected, so is very likely that you have refered some secrets like the following:

```typescript
const ecCluster = new _elasticache.CfnReplicationGroup(this, 'ecCluster', {
    replicationGroupDescription: ecName,
    replicationGroupId: ecName,
    atRestEncryptionEnabled: true,
    transitEncryptionEnabled: true,
    authToken: ecSecret.secretValueFromJson('authToken').toString(),
    automaticFailoverEnabled: true,
    cacheNodeType: context?.coreCacheSize,
    cacheSubnetGroupName: ecSubnetGroup.cacheSubnetGroupName,
    engine: 'Redis',
    engineVersion: '6.x',
    multiAzEnabled: true,
    numNodeGroups: context?.coreCacheNodeGroups,
    replicasPerNodeGroup: 1,
    port: redisPort,
    securityGroupIds: [ecSecGroup.securityGroupId],
});
```

Since `authToken` field is a string one, you cannot use the `cdk.SecretValue` class, so you need to parse it to string.

However, this way to do so, will miserably fail in CDK v2 if you have the mentioned feature flag enabled, with an error like this: `Using a SecretValue here risks exposing your secret. Only pass SecretValues to constructs that accept a SecretValue property, or call AWS Secrets Manager directly in your runtime code. Call 'secretValue.unsafeUnwrap()' if you understand and accept the risks.`

As suggested, we can avoid the problem using `unsafeUnwrap()` instead of `toString()` that will produce exactly the same CloudFormation output:

```json
{
    "Resources": {
        "ecCluster": {
            "Type": "AWS::ElastiCache::ReplicationGroup",
            "Properties": {
                "ReplicationGroupDescription": "dev-core-cache",
                "AtRestEncryptionEnabled": true,
                "AuthToken": {
                    "Fn::Join": [
                        "",
                        [
                            "{{resolve:secretsmanager:",
                            {
                                "Ref": "ecSecretA9175B4A"
                            },
                            ":SecretString:authToken::}}"
                        ]
                    ]
                },
                "AutomaticFailoverEnabled": true,
                "CacheNodeType": "cache.t3.small",
                "CacheSubnetGroupName": "dev-core-subnetgroup",
                "Engine": "Redis",
                "EngineVersion": "6.x",
                "MultiAZEnabled": true,
                "NumNodeGroups": 1,
                "Port": 6379,
                "ReplicasPerNodeGroup": 1,
                "ReplicationGroupId": "dev-core-cache",
                "SecurityGroupIds": [
                    {
                        "Fn::GetAtt": [
                            "ecSecGroupBB1BCBBD",
                            "GroupId"
                        ]
                    }
                ],
                "TransitEncryptionEnabled": true
            },
            "UpdatePolicy": {
                "UseOnlineResharding": true
            },
            "Metadata": {
                "aws:cdk:path": "infra-core-dev/ecCluster"
            }
        }
    }
}
```

### Passing ecr asset image uri property

If at some point of your code your using something like this:

```python
...
codebuild.LinuxBuildImage.from_ecr_repository(image.repository, image.image_uri.split(":")[-1])
...
```

Where `image` is a `DockerImageAsset` you need to be aware that the property `image_uri` is now rendered by CDK in a different way.

In CDK v1 `image.image_uri` produces something like this:

```shell
486290746615.dkr.ecr.us-west-2.${Token[AWS.URLSuffix.10]}/aws-cdk/assets:ca4fd4996d0eb2a8ca2355b186b3eaf33bf5723f21159d2137eea8b5318cba55
```

And in CDK v2 is like this:

```shell
${Token[TOKEN.198]}
```

That will produce a wrong repository/tag reference in the synthetized CloudFormation template:

```json
{
    "testservicetestserviceprojectFA4C378E": {
        "Type": "AWS::CodeBuild::Project",
        "Properties": {
            "Artifacts": {
                "Type": "NO_ARTIFACTS"
            },
            "Environment": {
                "ComputeType": "BUILD_GENERAL1_SMALL",
                "Image": {
                    "Fn::Join": [
                        "",
                        [
                            "486290746615.dkr.ecr.us-west-2.",
                        {
                            "Ref": "AWS::URLSuffix"
                        },
                            "/cdk-hnb659fds-container-assets-486290746615-us-west-2:",
                            {
                                "Fn::Sub": "486290746615.dkr.ecr.us-west-2.${AWS::URLSuffix}/cdk-hnb659fds-container-assets-486290746615-us-west-2:b2fcda7e94bebb985722f3b7d5b68462efa9a9536459683962ea537b8ff52723"
                            }
                        ]
                    ]
                },
            }
        }
    }
}
```

That can lead into broken deployments that you might not even notice until you effectively deploy the CodeBuild project since it will not be able to find the image producing a [very annoying error](https://github.com/upadvisors/nira-cdk/issues/14#issuecomment-1167269927) that is really hard to debug.

There is a way to prevent this issue:

```python
codebuild_project = codebuild.Project(
    self,
    f"{self.service}-project",
    project_name=f"{self.service}-project",
    build_spec=BuidlSpecHelper.get_buildspec(
        file_location="buildspec.yml",
    ),
    environment=codebuild.BuildEnvironment(
        build_image=codebuild.LinuxBuildImage.from_ecr_repository(image.repository, image.asset_hash),
        compute_type=codebuild.ComputeType.SMALL,
    ),
    logging=codebuild.LoggingOptions(
        cloud_watch=codebuild.CloudWatchLoggingOptions(
            log_group=logs.LogGroup(
                self,
                f"{self.service}-codebuild-log-group",
                log_group_name=f"/aws/codebuild/{self.service}",
                retention=logs.RetentionDays.TWO_WEEKS,
            ),
        ),
    ),
)
```

For more details visit [this comment](https://github.com/aws/aws-cdk/issues/2663#issuecomment-1167488629) and follow related issues.
