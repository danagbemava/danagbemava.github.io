---
layout: post
title: "Software Verification in the Age of Agents"
date: "2026-11-24"
categories: ai agents verification testing
---

Software engineers have been asking one question for as long as code has existed: “Does this actually work, and does it do what it is meant to do?”

Over the years, we have come up with several ways to answer it, though none of them is perfect.

I have been looking into this for a few weeks, and I want to share what I have found so far.

Broadly, there are two ways to verify that code does what it is supposed to do:

- Formal Verification
- Empirical Verification

Most engineers use empirical verification every day, whether or not they call it that. Formal verification is less familiar.

Formal verification is a mathematical proof that code matches a defined specification. This does not mean that the code does what you intended, only that it matches the specification. Typically, you write the specification in a formal language, such as Lean or Dafny, and use a tool to prove that the code satisfies it.

Often, the proof is much larger than the program, especially with interactive proof assistants. The [seL4 microkernel](https://trustworthy.systems/publications/papers/Klein_EHACDEEKNSTW_09.abstract), for example, has about 8,700 lines of C and about 200,000 lines of proof. More recently, in [Anthropic’s formal verification work with Theorem](https://www.anthropic.com/research/formal-verification), Claude wrote Rocq proofs for compiled RISC-V binaries from 123 open-source libraries: about 180 million lines in total, or about 600,000 lines for a typical binary of 18,000 instructions. This is why formal verification has been so tedious, and why it is seldom used for everyday software (although that could be changing; more on this later).

Empirical verification shows, with evidence or observation, that code does what it is meant to do: unit, integration and end-to-end tests, manual testing and so on. Unlike a proof, it can never guarantee correctness. As Edsger Dijkstra put it, “Program testing can be used to show the presence of bugs, but never to show their absence.”

Before agents, testing caught most bugs, but not all. Some appeared only under production load or in specialized environments; others only when real customers used the software in ways we did not predict.

Coding agents have made it easy to produce far more code than humans can reasonably review. That makes verification more important than ever, and it raises a question: how do you know that the code an agent wrote for you is correct?

Ideally, we would plan work in phases to keep oversight of the agents. But because agents move so fast, employers and clients often push timelines that leave little room for proper verification. We need systems that make agents’ work easy to verify, and many of the tools for this already exist.

Today, most people verify an agent’s work by asking it for evidence: a screenshot, a screen recording, traces or logs. They then review that evidence to decide whether the agent did the right thing.

I do not think this is good enough, for two reasons. First, the agent is grading its own work, and it shows you only what it chose to show you. This is why senior engineers review junior engineers’ code. Second, another agent is not a reliable reviewer either, because agents are not consistent. [Research has found](https://arxiv.org/abs/2502.20747) that LLMs give different code reviews for identical inputs, even with settings meant to minimize randomness. In my experience, an agent that reviews the same code several times often finds bugs on a later pass that it missed on the first.

## The Tools

Each tool below addresses one of these problems. Antithesis and Bombadil make results repeatable. Fuzzers find inputs that nobody thought to test. Schemathesis checks code against a contract that the agent did not write. Diffy compares new behavior with old. Type checkers and TLA+ move toward formal methods. Most of these tools predate coding agents, but they matter more now than ever.

### Antithesis

Antithesis runs your software inside a deterministic hypervisor, so every run is fully reproducible. It explores many execution paths, including unusual timings and failures that are hard to trigger in normal tests, and when it finds a bug, it can replay the exact failure as often as you need. A failure is no longer something that may never happen again; it is a recording that you, or an agent, can go back to. Since March 2026, Antithesis has published open-source agent skills, so coding agents can set up tests, start runs and triage results themselves. The trade-off is that it is a commercial platform that takes effort to set up.

### Bombadil

Bombadil is Antithesis’s open-source tool for testing web UIs. You write properties in TypeScript, statements that must always, or eventually, be true, such as “the cart total is always the sum of the items in the cart”. Bombadil then explores the UI on its own and reports any sequence of actions that breaks a property. Because properties describe what the app must do, not how it does it, they still apply after an agent rewrites a page. It runs locally, in CI or inside Antithesis.

### Fuzzers

A fuzzer runs your code with huge numbers of generated inputs and looks for crashes and hangs. Coverage-guided fuzzers such as AFL++ and libFuzzer mutate the inputs that reach new code, so over time they get deep into the program, and Go has fuzzing built into its test tool. Neither you nor the agent has to imagine the bad input, and every crashing input is saved so that you can replay it. But fuzzing is still empirical: GitHub’s security team found 29 new vulnerabilities in GStreamer after seven years of continuous fuzzing in Google’s OSS-Fuzz. The Anthropic work above started from fuzz-test entry points and proved that the programs never crash on any input under 64 MB, which is exactly the guarantee that a fuzzer cannot give.

### Schemathesis

Schemathesis applies the fuzzing idea to web APIs. Built on Hypothesis, the Python property-based testing library, it generates valid and invalid requests from an OpenAPI or GraphQL schema and checks the responses for server errors and schema violations. The checks come from the API contract, not from the agent, so if an agent breaks the contract, Schemathesis finds it, whatever the agent’s own tests say. Its limit is the schema: without an accurate one, it cannot help much.

### Diffy

Diffy, open-sourced by Twitter in 2015, checks whether a change altered behavior that it should not have. It sends each request to three instances of a service: two run the known-good code, and one runs the new code. Differences between the two known-good instances, such as timestamps or random IDs, are treated as noise; what remains are real changes. This suits agent-written code, which can change more than it was asked to. The original repository is archived (its author maintains a fork, Opendiffy), but the method is worth knowing.

### Type Checkers

Type checkers are the verification tool that most engineers already use. TypeScript, mypy or Pyright, and the compilers of languages like Rust and Java check that values are used consistently before the code runs. In a sense, a type system is a small, automatic form of formal verification: it proves simple properties about every possible run, not only the runs you tested. Type checkers are deterministic and fast, so an agent can run them after every change and fix its own errors. One caution: an agent can silence a type checker with a cast, an “any” type or an ignore comment, so look for these in review or block them with a linter.

### TLA+

TLA+, created by Leslie Lamport, is a language for specifying designs. You describe a system’s states and the steps between them, and the TLC model checker explores every reachable state to check that your rules always hold. AWS has used it on critical systems since 2011; in DynamoDB’s replication design, it found three bugs, some of which needed 35-step sequences to reproduce. TLA+ verifies the design, not the code, so the code can still drift from it. But if agents write most of the code, the main job left for humans is to define correct behavior, and a TLA+ specification is a precise way to do that before any code exists.

## Conclusion

Coding agents have changed how much code we produce, but not what it takes to trust it. Evidence that the agent chose, or a review that may not give the same result twice, is not enough. We need checks that are repeatable and independent of the agent.

No single tool does everything. Type checkers and fuzzers are cheap enough to run on every change. Schemathesis and Diffy check behavior against a contract or a known-good version. Antithesis and Bombadil make hard bugs repeatable. TLA+ checks the design before any code exists. Together, they shift the human’s job from reading every line to deciding what “correct” means.

This is the first part of a series. In the next part, I will look at how software development, including verification, has evolved. After that, I will describe a development workflow with verification built in. In the meantime, I would like to hear how you verify your agents’ work, and what has worked for you.
