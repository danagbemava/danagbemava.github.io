---
layout: page
title:  "Agriconnect Game Engine"
permalink: /projects/game_engine
---

## Summary

A gamification engine built with Spring Boot and Java that powers the reward and engagement system for the Agriconnect platform. The engine manages point accumulation, leaderboard rankings, achievement tracking, and reward redemption for students enrolled in the program. It consumes events from other Agriconnect microservices via Apache Kafka and maintains its own game state in MongoDB.

---

## My Role

**Backend Engineer**

- Designed and built the game engine service from scratch as a Spring Boot microservice
- Modeled the point system, achievement definitions, and leaderboard logic in MongoDB
- Implemented Kafka consumers to react to student activity events (course completions, assessment scores, login streaks) and award points accordingly
- Built REST APIs for querying leaderboards, student point balances, achievement progress, and reward catalogs
- Designed the reward redemption flow with inventory tracking and eligibility validation
- Containerized the service with Docker for deployment alongside the rest of the Agriconnect platform

---

## Architecture

### High-Level Overview

```
┌───────────────────┐       Kafka Events       ┌──────────────────┐
│  Students &       │ ─────────────────────────►│   Game Engine    │
│  Institutions     │  (course completions,     │   Service        │
│  Service          │   assessments, logins)    │                  │
└───────────────────┘                           └────────┬─────────┘
                                                         │
┌───────────────────┐       Kafka Events                 │
│  Billing &        │ ─────────────────────────►         │
│  Payments         │  (payment confirmations)           ▼
│  Service          │                              ┌──────────┐
└───────────────────┘                              │ MongoDB  │
                                                   └──────────┘
```

### Technology Stack

| Category | Technologies |
|----------|-------------|
| Framework | Spring Boot 2.7, Spring Web MVC |
| Persistence | Spring Data MongoDB, MongoDB |
| Messaging | Apache Kafka (consumer groups, custom deserializers) |
| Security | Spring Security, OAuth2 Resource Server, JWT |
| DevOps | Docker, Maven, multi-environment profiles |
| Testing | Spring Boot Test, Embedded MongoDB |

### Key Design Decisions

- **MongoDB over PostgreSQL** — Game state (points, achievements, leaderboards) is document-oriented with frequent reads and writes. MongoDB's flexible schema fits evolving game rules better than rigid relational tables.
- **Event-driven point accumulation** — Points are awarded reactively via Kafka consumers rather than synchronous API calls, keeping the game engine decoupled from the core platform services.
- **Configurable rule engine** — Achievement and point rules are defined as data (not code), allowing non-engineering stakeholders to adjust gamification parameters without deployments.

---

## Features

- **Point System** — Students earn points for completing courses, passing assessments, maintaining login streaks, and other tracked activities
- **Leaderboards** — Ranked leaderboards filterable by programme, institution, and time period with pagination
- **Achievements** — Milestone-based achievements with progress tracking and unlock notifications
- **Rewards Catalog** — Redeemable rewards with inventory management and eligibility checks
- **Activity Feed** — Chronological log of point-earning events per student

---

### Related Posts

- [Debugging Kafka messages](/posts/2024-01-17-debugging-kafka-messages)
