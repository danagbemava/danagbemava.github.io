---
layout: post
title:  "Writing complex queries with JpaSpecification"
date:   "2024-01-17"
categories: backend java
---

### Background

In a project I worked on recently, I had a requirement that I needed to add search and filter capabilities to an endpoint that I had developed. There were a few filters and the search needed to be quite broad. At the time, I had started getting into the groove of writing queries again so my initial reaction was to start writing a query for the filter and search but I immediately realized that using a query for it would be the wrong approach. Let's use the following parameters as sample fields we could filter on: `status`, `created_at`, `disability_status`, `financial_aid_status` and then let's say the search should be able to match either `first_name`, `last_name`, `email` and `user_custom_id`. 

Considering that only one filter would be active at the time, and that the filters are pretty distinct on their own, if you wanted to write a query to handle this, you would most likely have to write a query for each filter and then apply the search, which would mean a lot of code for all of them or trying to combine them into a single query which would be a lot of work because the could not be applied or any of them could be applied and you'd need to do a lot of null checks before you get to the search term. So I decided to look for alternative ways to solve the problem and after probing chatgpt for some time I came across `JpaSpecification`.

### What is JpaSpecification?

In simple terms, `JpaSpecification` is similar to query builders from other `ORMs` in other languages. What this means is that it allows you build queries on top of other queries. The definition below is taken from https://medium.com/@bubu.tripathy/dynamic-query-with-specification-interface-in-spring-data-jpa-ae8764e32162

```
The Specification interface in Spring Data JPA is a powerful tool that allows developers to build dynamic queries with criteria-based predicates. It provides a flexible and expressive way to construct complex queries at runtime, enabling you to create more advanced and customizable data retrieval operations.
```

### How do we use it?

Well, to get started, you need to have your `JpaRepository` extend the `JpaSpecificationExecutor` interface. For this post, let's assume we have an existing `UserRepository` that extends `JpaRepository` defined like below.

```java
public interface UserRepository extends JpaRepository<User, Long> {
    // rest of interface methods...
}
```

We will add `JpaSpecificationExecutor` to this, so the repository now looks like

```java
public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {
    // rest of interface methods
}
```

Our repository will now inherit some methods from `JpaSpecificationExecutor`, the one we are most interested in for this particular case is `List<T> findAll(Specification<T> spec)` (T will now be User in our user repository). 

You can then define your specifications. To make it easier to reuse, you can create a `UserSpecification` class and define static methods. For example

```java
class UserSpecification {

    public static Specification<User> hasSomeStatus(String status) {
        return (root, cq, cb) -> status == null ? cb.conjunction() : cb.equal(root.get("some_param"), status);
    }

    // rest of methods
}
```

The `root` is your entity, so in this case `User`. 

`cq` refers to `CriteriaQuery` ->  CriteriaQuery is an interface that represents a JPA query that can be constructed programmatically. It is used to define the structure of the query, including the SELECT, FROM, and WHERE clauses, as well as ordering and grouping.

`cb` refers to `CriteriaBuilder` -> CriteriaBuilder is a factory for creating various parts of a CriteriaQuery. It provides methods for constructing expressions, predicates, and other query components.
You use the CriteriaBuilder to create conditions, expressions, and predicates that can be used in the WHERE clause of a CriteriaQuery.

We need to handle if the status is null, so we use `cb.conjunction()`. What this does (as far as I understand) is that it will ignore this parameter. If it is not null, it will then use `cb.equal` which will be used as a `WHERE` clause in the resulting query that would be run. It will only return entities that match the status specified. 


### Using the Specification Class

This is pretty straight-forward. In your service class, you will have to define a method to make use the method from your repository. Example 

```java
class UserService {

    @Autowired private final UserRepository userRepository;


    public List<User> findAll(...SomeParams) {
        return userRepository.findAll(
            Specification.where(UserSpecification.hasSomeStatus(status))
            .and(UserSpecification.someOtherStatus())
            .and(UserSpecification.someOtherOtherStatus()));
    }
}
```

`.and` is not the only method you can use. You can also use `.or` and a few other methods. If you need to match all the conditions, you can use `.and` otherwise, you can use any of the other methods. The good thing about this is that it also supports pagination, so you can make the results paged as well. 

### Conclusion

`JpaSpecification` gives you the ability to write complex queries in a readable and more-or-less straightforward way. This helped me quite a bit in the project as I didn't have to write convoluted queries that would not have been easy to maintain and perhaps not very re-usable. Sometimes, when you feel like there might be a better way to do something, just ask a question, you never know, there might be. 