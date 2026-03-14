---
layout: post
title:  "How Spring Data makes it relatively painless to switch databases"
date:   "2026-02-14"
categories: backend spring-data
---

### Introduction 

This isn't something you'd normally have to do in a production system but should you have to do it, Spring Data makes it relatively painless. 

There are several steps involved and various things to consider. Ideally, if it becomes necessary, you'd hope to have to do it before you get to production. However, if you have to do it in production, you'd have to do so in a way that minimizes downtime while preserving the integrity of your data. 

In my case, I had to switch from Neo4j to MongoDB. And the switch happened before we ever deployed to production, so there wasn't much to worry about (all data was disposable). In this post, I will cover how Spring Data made it relatively easy to switch and some steps I would have taken to perform the migration had this been in an actual production system. 

### Why Spring Data Makes This Possible

Before diving into the specifics, it's worth understanding *why* Spring Data makes database switches relatively painless. The key is **Spring Data Commons** — the shared abstraction layer that all Spring Data modules implement. Interfaces like `Repository`, `CrudRepository`, and `PagingAndSortingRepository` define a common contract for data access regardless of the underlying database.

This means that any service-layer code that depends on standard CRUD operations (`save`, `findById`, `findAll`, `deleteById`, etc.) doesn't need to change at all when switching databases. The portability exists at this abstraction level. Where things *do* require work is in custom queries and database-specific features — those don't transfer.

### Why the switch? 

Before I get into how the switch happened, I think it's important that I go over the why. 

I initially chose to go with Neo4j because of the nature of the data we would be storing. What is Neo4j anyway? 
Neo4j is a graph database. It is a NoSQL database that is designed to store and query graph data. It works best if your data can be represented as a series of relationships or the representation needs to be in a graph. In the application I was working on, we were going to save representations of data as trees, which is a form of graph data, so it kind of made sense to use Neo4j.

I built the application and it was working just fine until we started saving a bit more data on our staging server. 
A few issues arose, particularly, issues with speed. At that point, we had about 20,000 nodes in our database and reads were particularly too slow. Writes worked just fine (although, there was another issue we would hit with writes later). 

To mitigate the slow reads, I looked into the APOC (Awesome Procedures on Cypher, Cypher is the query language for Neo4j) library for Neo4j. It helped us speed up reads by a large margin — queries that used to take several seconds now took only milliseconds. This was great, but these speeds were achieved because we were only fetching a small subset of the data. 

This led to our second issue: because we were fetching only a subset of the data, we would lose data whenever we performed an update. From the looks of it, it seemed like partial updates weren't supported so the whole subgraph and all relevant data needed to be in memory before we could save it back to the database. This was not a scalable solution.

There's a solution to this, don't get me wrong, it is to use `Projections` when fetching data and then write custom `Cypher` queries to update the data. But that's a lot of boilerplate code and it's not very scalable. 

> NOTE: This could be a case of "holding it wrong", but at the time, I explored the solutions I had, and I had to switch to a different database. 

### Why MongoDB?

I decided to switch to MongoDB because it was another type of `NoSQL` database that used a Document storage structure and this seemed like a good fit for our use case.

### The Switch

When doing the switch, there were a few things I needed to consider, primarily, how the two databases modeled relationships. 

Neo4j is a graph database, so it models relationships as first-class citizens. 
MongoDB is a document database, so it models relationships as embedded documents or references. 

This meant I had to rethink my entire data model. 

In Neo4j, everything could just use `@Relationship(direction = Relationship.Direction.OUTGOING/INCOMING)` — no extra work needed. 
In MongoDB, I had to decide whether to use embedded documents or references. 

I decided to use a hybrid approach, where some relationships were embedded and others were references. This is because MongoDB has a 16MB limit on document size. Most often, you wouldn't hit the limit, but this was a case where we didn't know what the size of the data was going to be ahead of time. The size of the data would grow as we scaled, so making the right decision at this point was very crucial. 

Here's a concrete look at what changed and what stayed the same:

#### Annotations

| Neo4j | MongoDB | Notes |
|-------|---------|-------|
| `@Node` | `@Document` | Marks a class as a database entity |
| `@Relationship` | `@DocumentReference` | Models references to other documents. `@DocumentReference` is preferred over the older `@DBRef` |
| N/A | *(no annotation)* | Embedded documents in MongoDB require no annotation — any nested object is embedded by default |

#### Repository

```java
// Neo4j
public interface NodeRepository extends Neo4jRepository<StepNode, UUID> {
    // custom Cypher queries
}

// MongoDB — only the interface type changes
public interface NodeRepository extends MongoRepository<StepNode, UUID> {
    // custom Mongo queries
}
```

#### What stayed the same

The service layer that called `nodeRepository.save()`, `nodeRepository.findById()`, and `nodeRepository.deleteById()` required **zero changes**. This is the real power of Spring Data's common `CrudRepository` abstraction — the database is an implementation detail behind the interface.

#### What required a rewrite

The Cypher queries that had been written needed to be rewritten in the MongoDB query language. This was time consuming as I needed to check the correctness of the queries and make sure they were doing what they were supposed to do. However, with the help of a few LLMs, I was able to get it done in a few days.

It's worth noting that this is a fundamental limitation of database portability: **database-specific features don't transfer**. Neo4j's graph traversals, MongoDB's aggregation pipelines — these are powerful precisely because they're tailored to their respective data models. Spring Data's abstraction gives you portability at the CRUD level, but anything beyond that is inherently database-specific.

After the switch, I performed tests to make sure that the application was working as expected. 

I deployed to staging, and performance had improved significantly — we weren't losing data on writes anymore. 

### What would this look like on a Production System? 

In a production system, I couldn't just rip out the database and replace it with another one. We would lose all the data that my service was responsible for. 

So, I would have to perform a data migration. Here's how I would approach it:

**Step 1: Data Modelling**

The first step would always be the data modelling — designing the MongoDB schema to correctly represent the data currently stored in Neo4j.

**Step 2: Dual-Write Phase**

For a few weeks or months, we would run both databases in parallel. Every write operation in the service layer would write to both Neo4j and MongoDB simultaneously. This could be implemented at the application level (e.g., writing to both repositories in each service method) or through an event-based approach using something like a Change Data Capture (CDC) pipeline.

The reads would still come from Neo4j during this phase, so the system's behavior remains unchanged from the user's perspective.

**Step 3: Data Migration Script**

A migration script would backfill the MongoDB database with all existing data from Neo4j. This would be done in batches to minimize the impact on the system. In our case, the surface area was limited to data created and maintained by our service — other data could be reconstructed from events through Kafka.

**Step 4: Validation**

Before cutting over, we would need to validate data consistency between both databases. This could involve running read queries against both databases and comparing results, or checksumming records to ensure nothing was lost or corrupted during migration.

**Step 5: Cutover**

The actual cutover — switching reads from Neo4j to MongoDB and stopping dual writes — would be done during a maintenance window to minimize risk. Having a rollback plan (switching reads back to Neo4j) is also critical in case issues surface after the cutover.

### Conclusion

Spring Data's layered abstraction — particularly Spring Data Commons — makes switching databases less painful than it would otherwise be. The standard CRUD operations transfer seamlessly, and the repository pattern means your service layer stays largely untouched. The real work lies in rethinking your data model, rewriting custom queries, and (if in production) carefully migrating your data. It's never truly *painless*, but Spring Data takes a lot of the sting out of it.
