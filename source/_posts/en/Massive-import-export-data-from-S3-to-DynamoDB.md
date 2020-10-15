---
title: Massive import/export data from S3 to DynamoDB
date: 2019-07-15 23:51:46
lang: en
label: massive-import-s3-dynamodb
tags: 
    - aws
    - s3
    - dynamodb
    - dms
    - import
    - export
    - terraform
categories: data-migration
---
![](/images/s3-to-dynamodb.jpg)

To begin with, I wanted to write at least one post explaining how it had been to create a serverless blog, but the truth is that I wanted to write this post first. I've had it in mind for some time.

This is one of those stories that write themselves.

Practically the first day in the office. I sit down, and after a few minutes when I had not yet set up the corporate email account, a colleague asks me a question:

**My buddy** - _"hey, they told me that Amazon thing, for you it's a piece of cake, right?"_

**Me** - _"well, I know something"_ - prudence to the power -

**My buddy** - _"you see, we have a project I'm working on, we have to load a lot of data into a dynamodb table"_ - a csv or data that could be easily taken to a csv - _"And we are doing it with the 25 by 25 using the SDK, but I get that this is very slow, do you know if there is any other way to do it that is faster?"_

**Me** - Interestingly, I had been preparing for the AWS Big Data certification a few weeks ago - which I failed like a champion - and I remember something. _"Yes, it sounds to me that there is something to do massively. Let me see if I can find it and tell you"_.

<!-- more -->

Indeed, with a simple search, I located some links among which was one of the official AWS documentation that was made using datapipeline. I mentioned it to my friend, and he told me that it was not necessary yet, so the subject stayed there and we took it up again later.

___
**TL;DR** Clone [my github repository](https://github.com/neovasili/dms-s3-import-to-dynamodb.git) and follow the readme steps in there ;)
___

## Discovery phase

Being a solution from AWS itself, I trusted that it would be the most optimal and probably the easiest to implement (yes, I have read myself, sometimes it seems that I have not learned anything over the years ...), so I got to it.

One of the first things that started to squeak at me was that **datapipeline**, although it had native support for s3 and dynamodb, below it, a cluster of **EMR** (AWS Elastic Map Reduce) is raised, something like this, sounds excessive to me for our use case. However, it made sense, if what we were going to import was a large amount of data.

Although I had studied them, it was my first time using both services, so at first I didn't really understand how they worked. I read some documentation and found some scheme that clarified the subject a little more. Immediately afterwards, I began to "taste it".

Second thing that squealed at me. The invention took more than 30 minutes just to get up and another 15 to die, something that, on the other hand, was logical considering that the cluster had three very thick nodes with a lot of plumbing that I did not want to understand too much. This was going to be a significant cost if it had to stay up for a long time, but it was supposed to be a single load (I was deluded) and that with all that power it was not going to take long.

And so much. The import process with a test file of 120 thousand tuples, hardly took 15 or 20 seconds, but it hit like popcorn. The worst thing is that I didn't see clearly where the explosion was and on the third try, the veins in my skull began to swell and I thought there had to be something simpler that could work as well.

## DMS

Searching in the hell I found [a post from the official AWS blog](https://aws.amazon.com/es/blogs/database/migrate-delimited-files-from-amazon-s3-to-an-amazon-dynamodb-nosql-table-using-aws-database-migration-service-and-aws-cloudformation/) which said that you could use **AWS Database Migration Service** (DMS) to use s3 source and dynamodb target. So it seemed like there was another good looking alternative.

I got down to work and saw that indeed in the official DMS documentation it allowed to configure s3 as [_source endpoint_](https://docs.aws.amazon.com/es_es/dms/latest/userguide/CHAP_Source.S3.html) and DynamoDB as [_target endpoint_](https://docs.aws.amazon.com/es_es/dms/latest/userguide/CHAP_Target.DynamoDB.html).

Needless to say, this same process can be done in reverse and choose dynamodb as source and s3 as destination, hence in the title I have put _import / export_, but I will focus on the _import_, since it was the origin of this history.

## Terraform

In order that all this invention is reusable and also that you can eliminate all the resources that you are going to create once you no longer need them in a simple way, I used the well-known infrastructure as code tool [terraform](https://www.terraform.io).

The first time, actually, I did it because in order to test that everything was working fine, I did it in an AWS account that we had for testing and I wanted it to be easily exportable to the production account where we would use it later. A smart move on my part.

You have in my github repo all the example terraform code used in this article for you to download and apply on the fly: https://github.com/neovasili/dms-s3-import-to-dynamodb.

### Source endpoint

Configure s3 as a source endpoint, it comes to something like this:
{% gist 10bcee0928a76d53e467ff923ffaa568 %}

The highlight is the **table structure** (_external_table_definition_), which is neither more nor less than a json file that defines the data structure of the csv. For example:

{% ghcode https://github.com/neovasili/dms-s3-import-to-dynamodb/blob/master/files/extra_connection_attributes.json %}

In this structure, these attributes should be highlighted:

* **TableName**. As its name indicates it is the name of the source table.
* **TablePath**. DMS to work with S3 requires that the files have a specific minimum path, where this will be: `schema_name / table_name` and hence the previous attribute. Thus, the minimum structure you need in your S3 bucket to work with DMS is: `bucket_name/schema_name/table_name/*.csv`.

### Target endpoint

This is a lot of simpler:

{% gist e6611f3300b32635600960617c3061fd %}

### Replication instance

Apart from the name, you can configure things like the VPC in which it will be - if it is not specified, it is created in the one that AWS gives you by default - the disk size, the version of the instance's DMS engine - I would use the latter whenever it is possible - if it will be in multi-az or if it will be publicly accessible, among other things.

At this point you can also choose the **size of the replication instance**. By default a dms.t2.medium is selected, but you can modify it as you see fit. We must also take into account the [free tier](https://aws.amazon.com/es/dms/free-dms/), otherwise, the prices are available here: https://aws.amazon.com/es/dms/pricing/.

It is also important that you consider that the larger the replication instance, the greater the network throughput you will have and therefore the faster you will be able to send data to DynamoDB. This is also conditioned, obviously, by the writing and reading capacity that you give to the target table.

{% gist e258d7f23e22a69c7c66166ebf6fa0f0 %}

That _depends on_ whether the role, as of today, does not work as expected. When I started with this, I realized the problem was there and reported it, but it does not seem to be solved as you can see in the [issue thread](https://github.com/hashicorp/terraform/issues/20346) and [the one created](https://github.com/terraform-providers/terraform-provider-aws/issues/7748) from this.

The _workaround_ in this case is as simple as doing `terraform apply` once - it will give you an error when creating the replication instance - and running `terraform apply` again so that all the elements that were not created in the first step are created.

It is also important that the role name that goes in _depends on_ having a specific and very concrete name: `dms-vpc-role`. If for some reason, you give it another name, change the hyphens to underscores or add some type of prefix / suffix, that does not work, that simple.

### Replication task

Lastly, the most important part, the replication task.

Basically, it's going to be what connects all the pieces together and gets your import process going. The type of replication to be carried out is also defined. DMS gives you three types:

* **Migrate existing data**. A single bulk load of data from source to destination. It is the one I describe in this article.
* **Migrate existing data and replicate ongoing changes**. It carries out an initial bulk load from origin to destination and then replicates the changes that are coming in. Shockingly useful.
* **Replicate data changes only**. Does not perform initial load, only replicates between origin and destination.

{% gist a9b3648dfad923e4a790f6f904ad1357 %}

Here, in addition to connecting the elements described above, you have to consider a couple of things:

* **Settings** of the replication task. Json file with multiple advanced task settings. What may interest you in this is the definition of the cloudwatch loggroup and logstream -initially they have to be empty, so to set them you must do it once the task is created - so that you can track what happens in your replication tasks.
* **Mappings** of the tables. That is, which columns correspond from the source, with which columns at the destination. For example:

{% ghcode https://github.com/neovasili/dms-s3-import-to-dynamodb/blob/master/files/table_mappings.json %}

There is a GUI version of this mapping in DMS, but honestly it seems more confusing to me than with json, although it is also true that there is little documentation on the structure of this json, so _have it your way_;)

What you have to know about this json is that the first two blocks refer to the source "table" - remember that we had _schema_name_ and _table_name_ - and in the third block we reference the destination.

In this last block, in addition, it is where we say which attributes of the origin - those that are referenced with the double dollar - correspond to those of the destination.

### Run and teardown

Once you have all the infrastructure up and running, and the .csv files in place, you just have to start the replication task either from the AWS web console or via aws cli.

When you're done with your replication / import / export tasks, you can set everything on fire with `terraform destroy`, but you have to bear in mind that **there will be a couple of things that will not be eliminated**: the cloudwatch logs and the exclusions table in DynamoDB.

This last item is created by DMS when a replication task is triggered for the first time. It is assumed that DMS will send there everything that for whatever reason has not been able to replicate from source to destination.

After using this procedure several times, nothing has ever been sent to that table, but I understand that it can happen. Keep that in mind.

## Conclusions

Ok, I know that it is a long post and that it seems quite complex, but with these indications, in nothing that you use it once, you will see that DMS is a very powerful tool, which solves a problem that may seem stupid at first glance, but which however saves us a lot of headaches and time.

I do not remember exactly how long the entire import process lasted with the real data, it was a few hours, but I do remember that the estimate we made with the "manual process" was more than a week importing data.

For our use case we use an instance type dms.t2.large and we raise the provisioning of DynamoDB to 300 units of writing and 1000 units of reading. I would like at some point to do more tests playing with these values ​​to compare results.

DMS, apart from logs, also has a small _dashboard_ that allows you to monitor the process.

I do not doubt the usefulness of the EMR + datapipeline solution, but I am clear that, in this case, this solution is much more optimal in terms of time and costs. With DMS the only cost that was assumed was the temporary provisioning of DynamoDB read and write units, which with datapipeline would also have been necessary.

Infrastructure as code to power. In the end, we had to make some adjustments and do the full import of the data a couple more times. It was incredibly useful to have everything set up so that just by throwing a couple of commands, it was all set.

I was looking forward to writing this article and sharing my experience with you on this matter. As a general rule, I like to touch the ins and outs and know the guts of the systems, I am quite in favor of _doing it yourself_ and _configuration over convention_, but also of using already built systems if the solution is profitable. We cannot pretend to know everything.

Thanks for reaching the end. I hope it is useful to you sometime ;)
