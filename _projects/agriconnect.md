--- 
layout: page
title:  "Agriconnect"
permalink: /projects/agriconnect
---

## Summary

A microservices-based backend platform for managing student enrollment, institutional operations, billing, and payments for the Agriconnect program. Built with Spring Boot 2.7.17 and Java 17, the system comprises two independent services communicating via Apache Kafka — one for student and institution management, and another for billing and payment processing. The platform integrates multiple payment gateways (Kowri, NGeniusCard, NSANO), uses PostgreSQL for persistence, and supports real-time updates via WebSocket.

---

## My Role

**Backend Engineer**

- Designed and implemented the microservices architecture from the ground up
- Built RESTful APIs for student management, institutional operations, invoicing, and payment processing
- Integrated multiple third-party payment gateways (Kowri, NGeniusCard, NSANO/USSD)
- Implemented event-driven communication between services using Apache Kafka
- Set up OAuth2/JWT-based security with role-based access control
- Designed the database schema and managed migrations with Flyway
- Built batch processing pipelines for bulk data import/export using Spring Batch
- Implemented real-time notification delivery via WebSocket/STOMP
- Containerized services with Docker for deployment across dev, staging, and production environments
- Integrated Firebase for secure document storage (dispute documents, ID uploads)

---

## Architecture

### High-Level Overview

```
┌──────────────┐       Kafka        ┌──────────────────┐
│  Students &  │◄──────────────────►│   Billing &      │
│ Institutions │                    │   Payments       │
│   Service    │                    │   Service        │
│              │                    │                  │
└──────┬───────┘                    └────────┬─────────┘
       │                                     │
       ▼                                     ▼
  ┌──────────┐                        ┌──────────┐
  │PostgreSQL│                        │PostgreSQL│
  │  (main)  │                        │  (main)  │
  └──────────┘                        └──────────┘
       │
       ▼
  ┌─────────────┐
  │PostgreSQL   │
  │ (reporting) │
  └─────────────┘
```

### Service Architecture (Per Microservice)

Each service follows a **layered architecture**:

| Layer | Responsibility |
|-------|---------------|
| **Controller** | REST endpoints, request validation, OpenAPI docs |
| **Service** | Business logic, orchestration, Kafka publishing |
| **Repository** | Data access via Spring Data JPA |
| **Entity** | JPA-mapped domain models |
| **Domain/DTO** | Request/response objects, validators |

### Key Design Patterns

- **MVC** — Controller-Service-Repository layering
- **Specification Pattern** — Composable JPA queries for filtering invoices, payments, reimbursements
- **Publisher-Subscriber** — Kafka-based async inter-service messaging
- **AOP / Aspects** — Cross-cutting concerns (logging, invoice validation)
- **Builder Pattern** — Lombok `@Builder` for DTOs

### Technology Stack

| Category | Technologies |
|----------|-------------|
| Framework | Spring Boot 2.7.17, Spring Web MVC, Spring WebFlux |
| Persistence | Spring Data JPA, Hibernate, PostgreSQL, Flyway |
| Messaging | Apache Kafka (custom serializers/deserializers) |
| Security | Spring Security, OAuth2 Resource Server, JWT (Nimbus JOSE) |
| Real-time | WebSocket, STOMP, SockJS |
| Batch | Spring Batch |
| File I/O | Apache POI, FastExcel, Commons CSV |
| Storage | Firebase Admin SDK (document uploads) |
| Payments | Kowri, NGeniusCard, NSANO APIs |
| DevOps | Docker, Maven, multi-environment profiles (dev/staging/prod) |
| Docs | SpringDoc OpenAPI 3.0 / Swagger UI |
| Testing | Spring Boot Test, H2 (in-memory), Spring Kafka Test |

---

## Features

### Students & Institutions Service

**Student Management**
- Student enrollment with invitation codes and multi-step onboarding workflow
- Bulk student upload/download (CSV/Excel)
- Student lookup by ID, email, or institution with paginated, filterable results
- Email updates, confirmation resending, and student deletion
- Financial aid and disability status tracking

**Institution & Programme Management**
- Organisation/institution hierarchy management
- Programme (study course) creation and management
- Operating country tracking
- Bulk data import from files

**Data Dispute Management**
- Students can raise disputes on incorrect personal data
- Document upload to Firebase Storage (ID documents, supporting files)
- Dispute lifecycle tracking

**Reporting & Analytics**
- Dedicated read-optimized reporting database
- Student statistics by multiple dimensions (programme, institution, aid status, disability)
- Equipment/laptop request tracking

**Real-Time Updates**
- WebSocket notifications for batch job completion and async operations

---

### Billing & Payments Service

**Invoice Management**
- Invoice generation per student with support for multiple purposes (Equipment, Tuition, etc.)
- Invoice status tracking
- Paginated, filterable invoice listing with JPA Specifications
- Custom metadata (key-value pairs) on invoices

**Payment Processing**
- Multiple payment gateway integrations:
  - **Kowri** — Mobile money and card payments
  - **NGeniusCard** — Card payment provider
  - **NSANO** — Telecom/USSD-based payments
- Transaction verification and status checking against gateways
- Payment retry for failed transactions
- Webhook handlers for payment callbacks

**Reimbursement Management**
- Manual and batch reimbursement triggering
- Supplementary reimbursement flow (MTN-specific)
- Reimbursement status tracking and reporting

**Fee Management**
- Fee structures defined by country and organisation
- Fee lookup for applicable charges

**Financial Reporting**
- Payment and reimbursement reports with CSV/Excel export
- Filterable report generation for finance teams
- Financial reconciliation support

---

### Cross-Cutting Concerns

- **Security** — OAuth2/JWT authentication, role-based access control (`@PreAuthorize`), RSA public key validation
- **Inter-Service Sync** — Kafka-driven model synchronization (students, organisations) between services
- **Database Migrations** — Flyway-managed schema versioning across all databases
- **Containerization** — Docker images with optimized JVM settings (`-Xms128m -Xmx512m`, Serial GC)
- **Environment Management** — Separate config profiles for dev, staging, and production


### Related Posts

- [Debugging Kafka messages](/posts/2024-01-17-debugging-kafka-messages)
- [JPA Specification: Complex Queries](/posts/2024-01-22-jpa-specification-complex-queries)
