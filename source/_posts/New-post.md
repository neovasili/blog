---
title: New post
date: 2019-06-19 22:07:12
tags:
---
{% asset_img terraform.png "terraform image" %}
The Serverless framework is the most popular deployment framework for serverless applications. 
<!-- more -->
It gives you a convenient abstraction over CloudFormation and some best practices out-of-the-box:
* Filters out dev dependencies for Node.js function.
* Update deployment packages to S3, which lets you work around the default 50MB limit on deployment packages.
* Enforces a consistent naming convention for functions and APIs.

But our serverless applications is not only about Lambda functions. We often have to deal with share resources such as VPCs, SQS queues and RDS databases. For example, you might have a centralised Kinesis stream to capture all applications events in the system. In this case, the stream doesn’t belong to any one project and shouldn’t be tied to their deployment cycles.

You still need to follow the principle of Infrastructure as Code:
* version control changes to these shared resources, and
* ensure they can be deployed in a consistent way to different environments
You can still use the Serverless framework to manage these shared resources. It is an abstraction layer over CloudFormation after all. Even without Lambda functions, you can configure AWS resources using normal CloudFormation syntax in YAML.