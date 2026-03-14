---
layout: post
title:  "Post-Mortem: Kafka Consumer Rebalancing Causes Student Onboarding Failure"
date:   "2024-01-17"
categories: backend java production kafka
---

> Staging is where you test your code. Production is where your code tests you ~ [quote](https://x.com/KiddBubu/status/1519759676145078272?s=20)

## Summary

A production incident caused newly onboarded students to be unable to request invoices from the billing service. The root cause was a Kafka consumer rebalancing loop triggered by default `max.poll.records` (500) being too high for our processing throughput. The consumer was repeatedly kicked from the group, resetting offsets and preventing new messages from being consumed.

**Severity:** High — student-facing functionality blocked  
**Duration:** ~1 day from discovery to resolution  
**Services affected:** Student Service, Billing Service  
**Root cause:** Kafka consumer rebalancing due to poll timeout exceeded  

---

## System Architecture

The platform is composed of several micro-services communicating primarily via Kafka. The services relevant to this incident are:

- **Student Service** — manages student biodata and onboarding status
- **User Service** — handles account creation, invitations, and authentication
- **Billing Service** — handles invoicing; depends on student biodata published by the Student Service

### Student Onboarding Flow

1. Institution admin uploads student biodata → published to Kafka
2. User Service creates the student account and sends an invitation
3. Student confirms their data and completes sign-up
4. Account-creation confirmation published to Kafka → Student Service updates onboarding status
5. Account-confirmed event published → Student Service marks user as onboarded
6. Student biodata published to Kafka → consumed by downstream services (Billing, etc.)

Only fully onboarded students have their biodata forwarded to downstream services. This design allowed other teams to work independently during development, though in hindsight it introduced tight coupling through the message ordering.

---

## Timeline

| Time | Event |
|------|-------|
| T-0 | Student successfully onboarded on production |
| T+? | Student attempts to request an invoice from the billing service |
| T+? | Billing service returns error: **"student not found"** |
| T+? | Engineering alerted; investigation begins |

---

## Detection

A support call reported that a student who had been onboarded could not request an invoice. The billing service threw an error stating the student could not be found — meaning the student's biodata had never been consumed by the billing service's Kafka consumer.

---

## Investigation

### Step 1: Check if data was published

Logs from the Student Service confirmed the biodata *had* been published to Kafka. The message was in the topic.

### Step 2: Examine consumer logs

The KafkaConsumer logs revealed something unexpected: the consumer was re-processing messages that should have already been consumed (data already present in the database). This was because:

- A previous workaround had republished older messages to backfill data.
- The service had been restarted, triggering a `ConsumerRebalanceListener` with a seek-to-beginning callback (originally added because this service was deployed later than others and needed to catch up on historical messages).

### Step 3: Offset tracking

We added offset logging and observed erratic behaviour — the consumer would read up to offset ~227, then jump back to offset ~98. The consumer was not making forward progress.

### Step 4: Identify the error

Two key error messages appeared in the logs:

**Poll timeout exceeded:**
```
consumer poll timeout has expired. This means the time between
subsequent calls to poll() was longer than the configured
max.poll.interval.ms, which typically implies that the poll loop is
spending too much time processing messages.
```

**Consumer kicked from group:**
```
Offset commit cannot be completed since the consumer is not part of
an active group for auto partition assignment; it is likely that the
consumer was kicked out of the group.
```

---

## Root Cause

The default `max.poll.records` in Kafka is **500**. Each poll returned up to 500 messages, and the processing time for that batch exceeded `max.poll.interval.ms`. This caused:

1. The consumer was **kicked from the consumer group** (rebalancing triggered)
2. On rejoin, the consumer had **not committed its offsets**, so it was re-assigned partitions at an earlier offset
3. The cycle repeated — the consumer would process partway through, get kicked, and restart from an earlier offset
4. **New messages at the tail of the topic were never reached**

Reference: [Dangerous Default Kafka Settings (Part 1)](https://medium.com/@Irori/dangerous-default-kafka-settings-part-1-2ee99ee7dfe5)

---

## Resolution

We reduced `max.poll.records` from the default (500) to **100** and restarted the service.

After the restart:
- Offsets advanced sequentially without jumping back
- All ~1600 messages on the topic of interest were processed in order
- The student biodata reached the billing service
- The affected student(s) were unblocked and could resume using the application

---

## Impact

- One or more students were unable to request invoices during the incident window
- No data was lost — all messages were eventually consumed after the fix
- No downstream corruption; the billing service received the correct biodata once processing caught up

---

## Lessons Learned

| What went well | What went wrong |
|---|---|
| Offset logging quickly revealed the rebalancing loop | Default Kafka settings were never reviewed for production workloads |
| The fix was non-destructive; no data was lost | The seek-to-beginning callback amplified the problem by forcing re-reads on restart |
| Team responded quickly once alerted | No monitoring/alerting on consumer lag or rebalancing events |

---

## Follow-Up Actions

| Action | Status |
|---|---|
| Set `max.poll.records=100` in production config | ✅ Done |
| Investigate why individual message processing is slow | ✅ Done |
| Evaluate increasing `max.poll.interval.ms` (constrained by managed Kafka provider settings) | ✅ Done |

