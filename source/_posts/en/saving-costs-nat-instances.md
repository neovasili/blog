---
title: Save transfer costs with managed NAT instances on AWS
date: 2024-05-11 19:00:00
lang: en
label: save-costs-nat-instances
tags: 
  - aws
  - cdk
  - costs
  - nat
categories: solutions
---
![ ](/images/saving-costs-nat-instances.jpg)

One of the main concerns when using cloud technology is costs and in certain cases data transfer costs to or from AWS can become a significant part of our bill.

This fact becomes particularly visible when we use NAT Gateways and our workloads make many requests "outwards", for example to other APIs.

NAT Gateway is an extraordinarily powerful and resilient service, but it has a pricing model which can easily cause a significant increase in data transfer costs, as charges are applied for each GB processed by each NAT Gateway, regardless of whether it is inbound or outbound traffic.

However, using NAT instances (using EC2), we only incur transfer costs from AWS to the internet.

In this post we will talk about a solution that implements the use of managed NAT instances instead of NAT Gateway in an efficient and resilient way.

<!-- more -->

## Solution design

The main problem with using NAT instances is that we move management and maintenance of these AWS instances to us. That is why it is preferable to use services 100% managed by AWS such as NAT Gateway and consider this type of solution only when necessary.

The main idea of ​​this solution is to reduce to a minimum the workload required to carry out this management and maintenance by automating the regular updating of NAT instances and establishing the most automated mechanisms possible to carry outFailover andFallback.

In this way, we will obtain a solution that once deployed will require very little attention and maintenance and that in turn will drastically reduce our transfer costs with respect to the use of NAT Gateway.

Let's see a general diagram of the solution:

![Nat instances high level design diagram](/images/nat-instances-high-level-design.png)

The design of this solution is partially based on the [Ben Whaley](https://medium.com/@benwhaley) explains in the post [How we reduced our AWS bill by seven figures](https://medium.com/life-at-chime/how-we-reduced-our-aws-bill-by-seven-figures-5144206399cb), although it contains some significant changes to how NAT instances are built and how they are replaced in case of failure or for maintenance.

From a general point of view, the solution has four perfectly differentiated parts:

- **Image creation pipeline** - how images for NAT instances are created and distributed.
- **NAT resources up and running** – the NAT instances itself and at least one NAT Gateway in standby as a backup.
- **Connectivity checker** - Lambda functions designed to verify that connectivity within private subnets in our VPC is still working; They are also responsible for activating the process of Failover in case of failure and issuing metrics on connectivity.
- **Workflows** - several state machines in charge of managing the life cycle of the solution.

In the repository [Nat instances](https://github.com/neovasili/nat-instances), you can find a complete version in CDK written in typescript of the solution described here.

Now let's look at each part of the solution in a little more detail.

## Image Creation Pipeline

We need a reliable and secure mechanism to produce new images for the updated NAT instances and replace the working instances with ones that use the new images.

AWS Image Builder is a self-managed service for just that purpose. With it we will create the NAT image creation pipeline.

Then we will see how we fire this pipeline from the maintenance state machine at regular intervals.

The pipeline does three different things:

- Build the image - we take the base image and apply the changes to convert it into a NAT instance (see [AWS documentation](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_NAT_Instance.html)).
- Test the image - with the image created, an instance is created that uses it and several tests are carried out to ensure that it does what it needs to do.
- Distribute the image - a copy of the final created image is created (and applied Tags) in each region we designate.

## Running NAT resources

Apart from our NAT instances created and running, we will also need to have NAT Gateways available that will act as a backup in case the NAT instances fail and also to use them as a "bridge" during maintenance tasks.

The normal state of the system will be that our NAT instances will be located in the public subnets of our VPC and the routing tables will send outgoing traffic from the private subnets to the network interfaces of the instances, thus making address translation effective. network.

During maintenance, the system will change this routing to use the NAT Gateways while the NAT instances are replaced with a new version of them and finally change the routing back to the NAT instances once they are available for use. .

In case of connectivity failure of the NAT instances, the system automatically changes routing to the NAT Gateways so that everything continues to work.

## Connectivity checker

And how does the system detect that the connectivity of the NAT instances has stopped working? Well, for that we have this component that we have calledConnectivity checker.

In essence, the solution places a Lambda function in each private subnet that we have that runs periodically and checks the "outward" connectivity of our system by making requests to urls that we provide.

In each execution, the Lambda functions make the requests and if these requests fail more than X times (the threshold that we define), the system considers that the connectivity is failing and triggers the workflow.Failover, which as we will see in the next section, is in charge of routing using the NAT Gateways.

An interesting detail is that since the Lambdas are within our VPC network and the connectivity is supposedly failing, we will need to have VPC endpoints in place to be able to "talk" to the service.StepFunctions, but theConnectivity checker will not be able to trigger Failover.

## Workflows

This is where the entire system contains the logic that we have been describing in the previous sections, that orchestration and automation that will help us greatly minimize the management and maintenance of the system.

To orchestrate all these processes, we have chosen StepFunctions and its StateMachines, using where possible the integration of StepFunctions with the different AWS services. This way, there is much less of your own code to maintain, since these integrations are managed and maintained by AWS.

The solution defines four workflows in four StateMachines many different:

- **Failover**: is responsible for replacing routing to use backup NAT Gateways.
- **Fallback**: performs the opposite operation, replaces routing to use our NAT instances.
- **NAT instance replacement**: trigger the Failover, and in parallel deletes the currently running NAT instances, while provisioning new instances using the latest version of the NAT images created.
- **Maintenance**: is responsible for keeping NAT instances updated, orchestrating all the necessary steps to make it possible in a secure and resilient way.

Let's look at this last one StateMachine in more detail.

### State Machine maintenance

The solution proposes to execute this workflow on a scheduled basis from time to time (for example every 14 days) to ensure that our NAT instances are properly updated.

![NAT instances maintenance workflow](/images/nat-instances-maintenance-workflow.png)

The idea is quite simple:

- Create a new version of the images of our NAT instances using the Image Creation Pipeline.
- Carry out the replacement of NAT instances by triggering the workflow for it.
- Trigger the Fallback to start using the new instances.

With the StateMachine, we ensure that each step is executed automatically and control what happens if something fails, thus preventing our connectivity from stopping working during this process.

Furthermore, thanks to StepFunctions, we have a very visual way of understanding what is happening at all times and, in the event of a failure, where the problem may be.

## Conclusions

We have seen how by using several AWS managed services we can arrive at a solution to automate the use, management and maintenance of NAT instances instead of NAT Gateways, considerably reducing data transfer costs in systems where a large number of external requests are made from our private subnets.

In that sense, we will need to know our throughput current network maximum in the system to choose an appropriate size of NAT instances that preserves the cost improvement but ensures system performance.

StepFunctions and its integrations with other AWS services play a fundamental role in this solution, since they allow us to reduce all the work of managing and maintaining our own code almost to zero.

## References

- [nat-instances repository](https://github.com/neovasili/nat-instances)
- [How we reduced our AWS bill by seven figures](https://medium.com/life-at-chime/how-we-reduced-our-aws-bill-by-seven-figures-5144206399cb) by [Ben Whaley](https://medium.com/@benwhaley)
- [NAT Instances - AWS Documentation](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_NAT_Instance.html)
