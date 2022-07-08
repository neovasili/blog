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

Not a secret that I"ve been working with AWS CDK in the last years, taking advantage of making infrastructure as code with common programming languages like python or typescript.

Recently, AWS CDK v1 has entered maintenance mode, which means that no new features or minor fixes will be applied to it, so if you are a regular user of CDK, you very likely will need to move to CDK v2 sooner than later, in case you haven"t done it yet.

Migrations are scary many times, so I"m going to talk a bit about the things I"ve experienced during this amazing journey.

<!-- more -->

<script>
    function openTab(type) {
        allTabs = document.querySelectorAll(".tabcontent");
        for (i = 0; i < allTabs.length; i++) {
            allTabs[i].style.display = "none";
        }
        tabsByType = document.querySelectorAll(`.${type}.tabcontent`);
        for (i = 0; i < tabsByType.length; i++) {
            tabsByType[i].style.display = "block";
        }
        tablinks = document.querySelectorAll(".tablinks");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace("active", "");
        }
        tablinks = document.querySelectorAll(`.${type}.tablinks`);
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.concat(" active");
        }
    }
</script>
<style>
    /* Style the tab */
    .tab {
        overflow: hidden;
        border: 1px solid #ccc;
        background-color: #f1f1f1;
    }

    /* Style the buttons inside the tab */
    .tab button {
        background-color: inherit;
        color: black;
        float: left;
        border: none;
        outline: none;
        cursor: pointer;
        padding: 14px 16px;
        transition: 0.3s;
        font-size: 17px;
    }

    /* Change background color of buttons on hover */
    .tab button:hover {
        background-color: #ddd;
    }

    /* Create an active/current tablink class */
    .tab button.active {
        background-color: #ccc;
        color: #1fa0ae;
    }

    /* Style the tab content */
    .tabcontent {
        display: none;
        padding: 6px 12px;
        border: 1px solid #ccc;
        border-top: none;
    }
    .tabcontent.default {
        display: block;
    }
</style>

As usual, you will find all code examples within [this repository](https://github.com/neovasili/migrating-cdk-v1-to-v2), so you can easily clone it and follow the post from the code.

Let's get started.

## Deployment permissions

How are you deploying your CDK code is quite important at this point. CDK v2 has changed S3 assets bucket name and ECR assets repository name, plus a new SSM parameter that is going to be used by CDK when deploying, so that can be translated into broken deployments after bootstrapping you AWS accounts if you don"t review the permissions you are granting to your deployment process.

If you are providing `AdministratorAccess` to your deployment roles and wanna continue living on the edge, hey, feel free to skip this section :)  but if you are restricting your deployment permissions at a more fine grained level, you have a couple of options to consider.

Let's assume a scenario where you are deploying your CDK infrastructure using CodeBuild via `cdk deploy` command, so you should have a CodeBuild project with a service role (let's call it _CodeBuild role_) attached. It's also possible that you are using the `--role-arn` option to deploy, thus, you are passing an additional different role to CloudFormation to effectively apply the CloudFormation changes set (let's call it _CloudFormation role_), so you have two different roles involved in your deployment process that you need to review.

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

If you try to make a CDK v2 deployment with a set of permissions that does not have those AssumeRole permissions, you will see some messages like this:

```shell
...
current credentials could not be used to assume "arn:aws:iam::ACCOUNT_ID:role/
cdk-CDK_ID-deploy-role-ACCOUNT_ID-AWS_REGION", but are for the right account. Proceeding anyway.
...
```

That means that CDK is trying to assume those extra new roles, but it can"t, so is going to use directly the provided set of permissions, in our scenario, CodeBuild role ones.

**The other option** is continuing using the deployment roles you were using for CDK v1.x., thus, not assuming the new roles, but you need to consider the changes explained below.

If your deployment roles are restricting access to S3 assets bucket or to the assets ECR repository by name, you need to be aware that both S3 assets bucket and ECR repository have a different name for CDK v2, so review the roles policies to allow CDK access to both assets resources with the new name.

The naming patterns of the assets resources changes as follows:

- For the S3 assets bucket: from `cdktoolkit-assetsbucket-*` to `cdk-*-assets-*-*`.
- For the ECR assets repository: from `aws-cdk/assets` to `cdk-*-container-assets-*-*`.

If you are using the `--role-arn` option for `cdk diff` or `cdk deploy`, the role that you are passing may also need access to the previously mentioned assets resources depending on the content of your CDK stacks. For example, if you are using `BucketDeployment` or `DockerImageAsset` constructs.

As already mentioned CDK v2 bootstrapping template also includes a new SSM parameter containing the bootstrap version that is also retrieved by CDK during deployments, so as well as with the mentioned assets resources naming changes, you also need to consider to grant extra new permissions for the actions `ssm:GetParameter` and `ssm:GetParameters` to your deployment roles. The name pattern of that SSM parameter is like this: `/cdk-bootstrap/*/version`.

## Use both CDK v1 and v2

Next thing to consider is that you very likely do not want to migrate all stacks at once, so you need to have the ability to operate with both versions at the same time from your machine. The best approach to achieve this, as recommended [in the AWS documentation](https://docs.aws.amazon.com/cdk/v2/guide/migrating-v2.html#work-with-cdk-v2-cli), is using npx and aliasing both versions (in your .bashrc/.zshrc file):

```shell
alias cdk1="npx aws-cdk@1.162.0"
alias cdk="npx aws-cdk@2.30.0"
```

First run of each alias will install the specified strict version.

## Bootstrap CDK v2

Once you have updated your deployment roles to avoid possible broken deployments as explained in the [previous permissions section](#Deployment-permissions), you need to bootstrap those accounts/regions (for CDK this is called [`environment`](https://docs.aws.amazon.com/cdk/v2/guide/environments.html)) where you have your CDK v2 stacks.

That will update the CDKToolkit CloudFormation stack with the new [bootstrapping template](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html#bootstrapping-template) adding some new resources as well as all necessary metadata to allow both CDK versions to work.

## Migrate existing stacks

Now comes the interesting part, the migration of your current CDK stacks. Most of this steps are already documented in the [oficial migration guide](https://docs.aws.amazon.com/cdk/v2/guide/migrating-v2.html), but let's dig a bit on them.

If you have a lot of stacks in the same CDK app, my suggestion for you is **create a parallel CDK v2 app** and move stack by stack from the v1 app to the v2 app so you can create smaller increments of the migration that you can deliver and at the same time you keep you operational response time under control. You can create a v2 folder in your repository and start there or create a v1 folder and move there the old app keeping "root" folder for v2 app (CDK apps are not coupled to folders, so this is safe) so it's easier in the future to just remove the v1 once you finished the migration.

Another recommendation is that if you have stacks that are deployed across different environments just with some different configuration options or parameter (in most of the scenarios that will be the case), just **be sure that all environments where the stacks are deployed are bootstrapped BEFORE start their migration**. That will give you the ability to quickly migrate them to the v2 app and remove them from the v1 app immediately after.

### Update feature flags from cdk.json

Quite simple, remove the old ones and add the following ones:

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

This one `"@aws-cdk/aws-iam:minimizePolicies": true` is quite interesting, since is going to let CDK "compress" those IAM policies if they contain duplicated or equivalent statements in order to optimize policy size, which is awesome, since there are some [IAM policy length hard limits](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html) that can cause more than one headache. At the same time, this "compression" action will order actions inside statements in alphabetic order, so if you keep the flag enabled, you _might see a lot of policies changes_ in your stacks related to statement actions re-ordering or optimization of policies.

### Updating dependencies and imports

This will depend on which language you are using to write your CDK apps, but at a very high level and as mentioned in the AWS docs, CDK have migrated their packages from "a package per service" approach to a single package library that contains all services (and other things) inside. Also, a new constructs package appears in the scene.

Easy cheesy. Let's see how it is for `python` and `typescript`.

<div class="tab">
  <button class="python tablinks active" onclick="openTab('python')">Python</button>
  <button class="typescript tablinks" onclick="openTab('typescript')">Typescript</button>
</div>

<div class="python tabcontent default">

Essentially, remove all `aws-cdk.*` dependencies and add this two:

```ini
aws-cdk-lib==2.31.0
constructs>=10.0.0
```

Versions of packages can differ depending on the latest version available.

`Construct` is now out of the _core_ package and is required for classes constructors or custom constructs so we need to add its import and change the constructors signature:

```python
from constructs import Construct
from aws_cdk import (
    aws_cdk as cdk,
    aws_s3 as s3,
    aws_ec2 as ec2,
)


class PythonStack(cdk.Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)
        # This is where the magic happens
```

</div>

<div class="typescript tabcontent">

Quite similar, remove (from dev, peer and general) all `@aws-cdk/aws-*` like dependencies and `@aws-cdk/core` and add the following ones:

```json
{
    "devDependencies": {
        "@types/prettier": "2.6.0",
        "aws-cdk": "2.31.0",
    },
    "dependencies": {
        "aws-cdk-lib": "2.31.0",
        "constructs": "^10.0.0",
    }
}
```

Remove any lock file and reinstall.

For imports and constructors signatures is a bit different from python, but still easy:

```typescript
import * as cdk from "aws-cdk-lib";  // import * as cdk from "@aws-cdk/core";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";



export class TypescriptStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        // This is where the magic happens
    }
}
```

</div>

### Secrets reference

One of the feature flags recommended by AWS to use in CDK v2 config is `"@aws-cdk/core:checkSecretUsage": true`. Even if you were using it in CDK v1, looks like depending on the version you were using it might not be working as expected, so is very likely that you have referred some secrets like the following:

<div class="tab">
  <button class="python tablinks active" onclick="openTab('python')">Python</button>
  <button class="typescript tablinks" onclick="openTab('typescript')">Typescript</button>
</div>

<div class="python tabcontent default">

```python
redis_cluster = elasticache.CfnReplicationGroup(
    self,
    "RedisCluster",
    replication_group_description="test redis cluster",
    auth_token=ec_secret.secret_value_from_json("authToken").to_string(),
    num_node_groups=2,
    cache_node_type="cache.t3.small",
    engine="Redis",
    engine_version="6.x",
    security_group_ids=[ec_sec_group.security_group_id],
)
```

</div>

<div class="typescript tabcontent">

```typescript
const redisCluster = new elasticache.CfnReplicationGroup(this, "RedisCluster", {
    replicationGroupDescription: "test redis cluster",
    authToken: ecSecret.secretValueFromJson("authToken").toString(),
    numNodeGroups: 2,
    cacheNodeType: "cache.t3.small",
    engine: "Redis",
    engineVersion: "6.x",
    securityGroupIds: [ecSecGroup.securityGroupId],
});
```

</div>

Since `auth_token/authToken` field is a string one, you cannot use the `cdk.SecretValue` class, so you need to parse it to string.

However, this way to do so, will miserably fail in CDK v2 if you have the mentioned feature flag enabled, with an error like this:

```shell
Using a SecretValue here risks exposing your secret. Only pass SecretValues to constructs that accept a 
SecretValue property, or call AWS Secrets Manager directly in your runtime code. Call 
'secretValue.unsafeUnwrap()' if you understand and accept the risks.
```

As suggested, we can avoid the problem using `unsafe_unwrap()/unsafeUnwrap()` instead of `to_string()/toString()` that will produce a CloudFormation output like this one:

```json
{
    "Resources": {
        "RedisCluster": {
            "Type": "AWS::ElastiCache::ReplicationGroup",
            "Properties": {
                "ReplicationGroupDescription": "test redis cluster",
                "AuthToken": {
                    "Fn::Join": [
                        "",
                        [
                            "{{resolve:secretsmanager:",
                            {
                                "Ref": "ecSecretXXXXXX"
                            },
                            ":SecretString:authToken::}}"
                        ]
                    ]
                },
                "CacheNodeType": "cache.t3.small",
                "Engine": "Redis",
                "EngineVersion": "6.x",
                "NumNodeGroups": 2,
                "Port": 6379,
                "ReplicasPerNodeGroup": 1,
                "SecurityGroupIds": [
                    {
                        "Fn::GetAtt": [
                            "ecSecGroupXXXXX",
                            "GroupId"
                        ]
                    }
                ]
            }
        }
    }
}
```

### Passing ecr asset image uri property

If at some point of your code your using something like this:

<div class="tab">
  <button class="python tablinks active" onclick="openTab('python')">Python</button>
  <button class="typescript tablinks" onclick="openTab('typescript')">Typescript</button>
</div>

<div class="python tabcontent default">

```python
codebuild.LinuxBuildImage.from_ecr_repository(image.repository, image.image_uri.split(":")[-1])
```

</div>

<div class="typescript tabcontent">

```typescript
codebuild.LinuxBuildImage.fromEcrRepository(image.repository, image.imageUri.split(":").slice(-1)[0])
```

</div>

Where `image` is a `DockerImageAsset` you need to be aware that the property `image_uri/imageUri` is now rendered by CDK in a different way.

In CDK v1 `image.image_uri/image,imageUri` produces something like this:

```shell
ACCOUNT_ID.dkr.ecr.AWS_REGION.${Token[AWS.URLSuffix.10]}/aws-cdk/assets:ASSET_HASH
```

And in CDK v2 is like this:

```shell
${Token[TOKEN.198]}
```

That will produce a wrong repository/tag reference in the synthetized CloudFormation template:

```json
{
    "TestServiceProject": {
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
                            "ACCOUNT_ID.dkr.ecr.AWS_REGION.",
                        {
                            "Ref": "AWS::URLSuffix"
                        },
                            "/cdk-CDK_ID-container-assets-ACCOUNT_ID-ACCOUNT_ID:",
                            {
                                "Fn::Sub": "ACCOUNT_ID.dkr.ecr.ACCOUNT_ID.${AWS::URLSuffix}/
                                cdk-CDK_ID-container-assets-ACCOUNT_ID-ACCOUNT_ID:ASSET_HASH"
                            }
                        ]
                    ]
                },
            }
        }
    }
}
```

That can lead into broken deployments that you might not even notice until you effectively run the CodeBuild job since it will not be able to find the image producing a very annoying error that is really hard to debug:

![CodeBuild failing job because of wrong CloudFormation image reference](/images/codebuild-cdk-error.png)

There is a way to prevent this issue:

<div class="tab">
  <button class="python tablinks active" onclick="openTab('python')">Python</button>
  <button class="typescript tablinks" onclick="openTab('typescript')">Typescript</button>
</div>

<div class="python tabcontent default">

```python
codebuild_project = codebuild.Project(
    self,
    "TestProject",
    project_name="TestProject",
    environment=codebuild.BuildEnvironment(
        build_image=codebuild.LinuxBuildImage.from_ecr_repository(image.repository, image.asset_hash),
        compute_type=codebuild.ComputeType.SMALL,
    ),
)
```

</div>

<div class="typescript tabcontent">

```typescript
const codebuildProject = new codebuild.Project(this, "TestProject", {
    projectName: "TestProject",
    environment: {
        buildImage: codebuild.LinuxBuildImage.fromEcrRepository(image.repository, image.assetHash),
        computeType: codebuild.ComputeType.SMALL,
    },
});
```

</div>

For more details visit [this comment](https://github.com/aws/aws-cdk/issues/2663#issuecomment-1167488629) and follow related issues.

### Check constructs compatibility

Fun is not over yet :D

Some L2/L3 constructs are not ready for the CDK v2, so we might need to do some "magic hacks" to get non destructive diffs.

#### MSK cluster L2


<div class="tab">
  <button class="python tablinks active" onclick="openTab('python')">Python</button>
  <button class="typescript tablinks" onclick="openTab('typescript')">Typescript</button>
</div>

<div class="python tabcontent default">

From this:

```python
const kafka_cluster = msk.Cluster(
    self,
    "KafkaCluster",
    cluster_name="kafka-cluster",
    kafka_version=msk.KafkaVersion.V2_8_0,
    vpc=vpc,
    instance_type=ec2.InstanceType("kafka.m5.large"),
    number_of_broker_nodes=1,
    configuration_info={
        "arn": msk_config.attr_arn,
        "revision": 1,
    },
)
```

We need to do something like this:

```python
kafka_sg = ec2.SecurityGroup(
    self,
    "KafkaSecurityGroup",
    description="MSK security group",  # Current CFN description
    vpc=vpc,
)
kafkaSgL1 = kafka_sg.node.defaultChild as ec2.CfnSecurityGroup
kafkaSgL1.overrideLogicalId("KafkaClusterSecurityXXXX");  # Current CFN logical ID

kafka_cluster = msk.CfnCluster(
    self,
    "KafkaClusterXXXX",  # Current CFN logical ID
    cluster_name="kafka-cluster",
    kafka_version="2.8.0",
    number_of_broker_nodes=3,
    configuration_info={
        "arn": msk_config.attr_arn,
        "revision": 1,
    },
    brokerNodeGroupInfo={
        "clientSubnets": vpc.privateSubnets.map((subnet: ec2.ISubnet) => { return subnet.subnetId }),
        "instanceType": "kafka.kafka.m5.large",  # Still trying to guess why this works...
        "securityGroups": [kafkaSG.securityGroupId],
        "storageInfo": {
                "ebsStorageInfo": {
                "volumeSize": 1000,
            },
        },
    },
    encryptionInfo={
        "encryptionInTransit": {
            "clientBroker": "TLS",
            "inCluster": True,
        },
    },
)
ec2.CfnSecurityGroupIngress(
    self,
    "KafkaClusterSecurityGroupfromOldStackdefaultsgXXXX",
    ip_protocol="tcp",
    description="Let me in",
    from_port=0,
    to_port=65535,
    group_id=kafkaSG.securityGroupId,
    source_security_group_id=defaultSG.securityGroupId,
)
ec2.CfnSecurityGroupEgress(
    self,
    "defaultsgtoOldStackKafkaClusterSecurityGroupXXXXX",
    ip_protocol="tcp",
    description="Let me in",
    from_port=0,
    to_port=65535,
    group_id=defaultSG.securityGroupId,
    destination_security_group_id=kafkaSG.securityGroupId,
)
```

</div>

<div class="typescript tabcontent">

From this:

```typescript
const kafkaCluster = new msk.Cluster(this, "KafkaCluster", {
    clusterName: "kafka-cluster",
    kafkaVersion: msk.KafkaVersion.V2_8_0,
    vpc,
    instanceType: new ec2.InstanceType("kafka.m5.large"),
    numberOfBrokerNodes: 1,
    configurationInfo: {
        arn: mskConfig.attrArn,
        revision: 1,
    }
});
```

We need to do something like this:

```typescript
const kafkaSG = new ec2.SecurityGroup(this, "KafkaSecurityGroup", {
    description: "MSK security group",  // Current CFN description
    vpc,
});
const kafkaSgL1 = kafkaSG.node.defaultChild as ec2.CfnSecurityGroup;
kafkaSgL1.overrideLogicalId("KafkaClusterSecurityXXXX");  // Current CFN logical ID

const kafkaCluster = new msk.CfnCluster(this, "KafkaClusterXXXX", {  // Current CFN logical ID
    clusterName: "kafka-cluster",
    kafkaVersion: "2.8.0",
    numberOfBrokerNodes: 3,
    configurationInfo: {
        arn: mskConfig.attrArn,
        revision: 1,
    },
    brokerNodeGroupInfo: {
        clientSubnets: vpc.privateSubnets.map((subnet: ec2.ISubnet) => { return subnet.subnetId }),
        instanceType: "kafka.kafka.m5.large",  // Still trying to guess why this works...
        securityGroups: [kafkaSG.securityGroupId],
        storageInfo: {
                ebsStorageInfo: {
                volumeSize: 1000,
            },
        },
    },
    encryptionInfo: {
        encryptionInTransit: {
            clientBroker: "TLS",
            inCluster: true,
        },
    },
});
new ec2.CfnSecurityGroupIngress(this, "KafkaClusterSecurityGroupfromOldStackdefaultsgXXXX", {
    ipProtocol: "tcp",
    description: "Let me in",
    fromPort: 0,
    toPort: 65535,
    groupId: kafkaSG.securityGroupId,
    sourceSecurityGroupId: defaultSG.securityGroupId,
});
new ec2.CfnSecurityGroupEgress(this, "defaultsgtoOldStackKafkaClusterSecurityGroupXXXXX", {
    ipProtocol: "tcp",
    description: "Let me in",
    fromPort: 0,
    toPort: 65535,
    groupId: defaultSG.securityGroupId,
    destinationSecurityGroupId: kafkaSG.securityGroupId,
});
```

</div>

As you can see, downgrading a L2/L3 construct to a L1 construct is quite painful and requires a lot of work.

It's important to know that Changes in CloudFormation Logical ID forces replacement of the resource, that's why we are _overriding_ or directly setting up constructs IDs with the existing ones provided by CDK L2 construct (you can find them in the produced CloudFormation template), so that way you avoid the replacement of the resource.

This can be assumed in some cases, like a security group rule, that can cause instant or no outage at all, but can also mean large outages or even worse, data lose when replacing data storage resources, so `you need to be extremely careful` with this, `cdk diff` will be our best ally here.

## Conclusions

Migrations always have pain points, even if you have a very straightforward guide to follow with just a few steps.

CDK is not an exception, it's a gorgeous framework, but it's complex enough to be free of issues during a major version migration like this one. The only way to discover them is to effectively perform a migration and face the issues on your own.

I've tried to gather all the ones I've already experienced and some detailed insights about CDK itself in order to help you better prepare for it. I hope you find it useful ;)
