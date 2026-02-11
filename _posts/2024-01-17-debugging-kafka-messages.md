---
layout: post
title:  "Post-Mortem: Kafka isn't reading new messages"
date:   "2024-01-17"
categories: backend java production kafka
---

A wise man once said
> Staging is where you test your code. Production is where your code tests you ~ [quote](https://x.com/KiddBubu/status/1519759676145078272?s=20)

### Background

I have been working on a project for a few months. It is a medium scale project made up of several micro-services. I worked on two micro-services for this project and we primarily used kafka to communicate between the various microservices. During the development phase, everything was more or less smooth and we didn't encounter any disturbing issues. We even had a pre-production environment that we run tests on before moving to production as well and it was all roses until we finally started onboarding actual students in production. 

### Discovering the issue 

A couple of days ago, I got a call that a student had been onboarded but when they tried to request an invoice, the billing service (the other service I worked on) threw an error stating that the student could not be found. This was rather strange because, with the flow of the app, if a student had been registered (onboarded), their data should have been in the billing service. 

### A little aside

Before I proceed to talk about, the issue, I feel it is necessary to discuss the flow of onboarding/registering students. 

Users are only allowed to access the platform by invitation, however, sign up for the students is a bit different. The students needed to have their biodata uploaded by the administrators of their institution first, then they would have to confirm their biodata before they could sign up. This meant that we needed to keep the biodata separate from the account data. This was because they could mess around with the account data all they needed but the biodata needed to remain untouched (because some of the data would appear on certificates for the students). 

The flow we came up with initially was, the institution admin would upload the data, the student would check their data and verify its correctness and then complete the sign up process. 

However, the sign up process process would need to be handled by the User service (another micro-service) and that micro-service required a token for signing up (since the system was invite only). So what we came up with was, the student data would be uploaded by the institution admin, then the data would be published to kafka along with a few items so that their account would be created, the user service would send them an invite and then they can go through the flow normally. 

Once they student account was created, a message would be published to a topic that I would then use to update the onboarding status of the student in my system and after the account was confirmed, another message would be published, then I would use that finally set the user as onboarded and then their data would be published to kafka so that other services that needed the student biodata would have access to the data. 

The idea behind this (at the time) was so that only those who had been onboarded would have access to the other systems. This design at the time allowed the other teams to work on the portion of their micro-services that didn't require student biodata data. Thinking back on it, it may not have been the best decision, but it worked for us so it was fine. Once they had the model definition, that was good enough for them. 

### Discovering the issue II

> Now that the flow of the application has been given, we can resume.

Considering that the billing service did not have the user data, my first thought was to check if the data had been published at all by the student service. I looked at the logs and I noticed something odd. It was filled with messages of my KafkaConsumer class consuming a lot of messages that should have already been consumed. I know this because I already had that data in my database. I then realized that when the student-service didn't have the data, we republished the data so that it would be consumed. Since the data was republished, it needed to consume all the data again and run the required operations. One other issue was also that we restarted the server so that it could consume the data that was not already consumed. How would restarting do this you ask? Well, we had registered a seek callback so the consumer would read from the first offset until the latest one. This was done because the service was deployed later than the other services and it wouldn't always be prudent to republish the data. 

That aside, in theory, the data should have continued until it got to the latest offset but this wasn't happening because of one of Kafka's default behaviour: it would try to re-read all the messages that were not processed and since the server had been restarted, a lot of data was still left in there that hadn't been processed. There was also consumer re-balancing that was happening because for some reason, it was taking longer than the default `max.poll.interval.ms` configured by kafka to process the messages. 

At this point, we decided to log the offset of the topics that the KafkaConsumer was reading. We noticed that it would read up to a certain point and then go back to an earlier offset. So imagine it would read messages up to offset 227, it would then jump back to say 98. 

So we looked through the logs again, and we chanced upon a strange message. 

```
consumer poll timeout has expired. This means the time between subsequent calls to poll() was longer than the configured max.poll.interval.ms, which typically implies that the poll loop is spending too much time processing messages. You can address this either by increasing max.poll.interval.ms or by reducing the maximum size of batches returned in poll() with max.poll.records.
```

We looked up the error message on the internet and we found an article written by someone that seemed to have experience a similar issue. https://medium.com/@Irori/dangerous-default-kafka-settings-part-1-2ee99ee7dfe5


For a lot of the kafka configuration (aside the consumer group and things we needed for our application), the defaults were in effect. So it was using the default `max.poll.records`, which is around 500. 


I also noticed a different message in the logs. 

```
failed: Offset commit cannot be completed since the consumer is not part of an active group for auto partition assignment; it is likely that the consumer was kicked out of the group.
```


This explained why the messages would go to a higher offset and then return to a lower offset. Kafka was trying to process all the messages but the order was randomized since for some reason, some messages were skipped and so it would go back and try to read those messages. 


### Fixing the issue

We decided to experiment with setting our `max.poll.records` to 100 and restarted the server. We monitored the logs and this time we noticed that the messages were being processed in order (the offset wasn't jumping around like before). For the topic we were interested in, the offset was around 1600 or so (I can't remember at this time). So we decided to leave the app for a while. I started checking the database to see if the newer records that we expected were coming and gradually, they did. It went on until all the messages were processed. This led to the app flow that was interrupted being resumed and the billing service ended up with the data it needed. So the student(s) were able to continue to use the application. 

### Planned work

At this point, I have come to understand a little bit more about the consumer re-balancing and why this phenomenon is occurring. A band-aid solution has been implemented because we needed to get the students onboarding and using the app as soon as possible. It works fine, but I plan on investigating why the processing of the records takes so long. I could set a higher `max.poll.internal.ms` but there's some config that is set by the kafka server we use on production, so there's also a limit to how much we can increase that time. Hopefully, the investigation will yield a result that will help us better process the message so we don't run into any more re-balancing issues. 