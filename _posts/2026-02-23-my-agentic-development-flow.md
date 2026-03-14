---
layout: post
title:  "My Agentic Development Flow"
date:   "2026-02-23"
categories: workflow ai agentic
status: incomplete
---

I've been using AI tools to help me with my development workflow for a while now and so far it's been a game changer. It has increase my velocity, helped me learn new things and made me more intentional about how I approach problems. 

I find that each model has things it is good at and things, well, it's not so good at. I've tried a few models and I've settled on a workflow that works for me. 


### Tools I Use

I use a few tools to help me with my development workflow. I have access to a number of models, so I typically switch based on whether or not I have hit my limits. I find that the tools these days are mostly comparable in most tasks so I don't really bother about which model to use provided I have my tasks clearly defined. 

- [Linear](https://linear.app/) -> For project management and task definition. 
- [Linear MCP](https://github.com/linear/linear-mcp) -> To allow the agents get full context on the task at hand
- [Context7 MCP](https://context7.com/) -> This gives the agent access to the latest documentation for the libraries, tool in the project so that it doesn't work with outdated information.
- [Claude](https://claude.ai/) -> For defining the tasks. I try to get as much detail as possible for the task. 
- Antigravity/[Codex](https://openai.com/blog/openai-codex)/[Copilot](https://github.com/features/copilot)/[Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) -> For implementation. I typically use the claude models for the code. I find that the claude models are the most consistent in terms of code quality. However, if I run out of credits, I switch to codex or copilot. Antigravity is typically what I use when I'm building flutter apps.


### FrontEnd UI Workflow

For my frontend workflow, I typically use gemini. Hear me out. I find gemini to be the more creative model out of the others. It doesn't take muuch to get a good frontend design from gemini. 

However, I find that if you allow it to go all out without any guardrails, it tends to mess stuff up. So, I typically start with a design system. You can use whatever design system you want, you can even have gemini generate one for you and then choose the component system that you want it to build that design with. 

Once I have a design system, I add a rule that it should follow the design system and that it should be responsive. 

### FrontEnd Logic Workflow

For my frontend logic workflow, I typically start with a properly defined task, typically in linear so that can I have the agent I'm using at the time read the task using the linear mcp. 
