---
layout: post
title:  "Reflections"
date:   "2026-05-22"
categories: thoughts reflection layoff
---

### Inspiration

I didn't think I was going to do this, it's been a while since I was laid off. It was just business and I'm really glad that my company has looked out for me the way they have. It was bound to happen at some point, that's just the nature of contract work.

The reason I'm writing this is because after watching this video [I was laid off by Atlassian (good video)](https://www.youtube.com/watch?v=55pTFVoclvE&pp=ygUaaSB3YXMgbGFpZCBvZiBieSBhdGxhc3NpYW4%3D), I realized I hadn't taken time to properly reflect on my time at Nevercode/CodeMagic as some of you know it as.

So today, I'm going to share my raw, unfiltered thoughts, as a sort of catharsis for me as that chapter of my life finally draws to a close.

### History

I joined Nevercode officially in August 2021 as an Open Source Support Engineer. I remember the interview process like it was yesterday. Fun fact, I did not get the job after the first round of interviews. I was kinda disappointed, but, that's life. A couple of months later, I received an email from the team lead at the time (who became a very good friend during my time there), about an opening in the team and if I was still interested in the role. I said yes, and the rest was history. The interview process itself was very straightforward. Introductory call/Skills assessment/Culture Fit -> Trial Day -> Final Interview/Offer. The second time around, I skipped all the initially stages and went to the offer stage (all other categories were deemed to be a match). 

__NB: I'm not using any names in this just to protect the privacy of my former colleagues, but those who know, know__


### Roles and Responsibilities

When I started back in 2021, the scope of our work covered quite a few large repositories. We were in charge of the flutterfire, flutter/flutter, flutter/website, dart-lang/site-www and google-ads iirc. I guess I haven't defined what/who an Open Source Support Engineer (OSSE) is, let me do that now. An OSSE is like a Support Engineer but for Open Source. Essentially, an Open Source Support Engineer is responsible for triage, issue hygiene and other support roles on an open source repository. The scope of work varies from project to project but, that's the basic idea. 

We were primarily responsible for front-line triage, i.e, first response to an issue to gather the requisite information before the issue was handed over to the appropriate repo owner for secondary triage/action. I must say, over the 4 years I worked at Nevercode, we got really good at it. We helped shape what the triage standards/process is today in the flutter/flutter repo. 

Over time, our scope of work reduced (perhaps, this was the writing on the wall), but then our work became more focused. Part of our team was responsible for fixing issues, part of our team was doing triage, and then there was me, seeing how flutter breaks under different circumstances (this was primarily during my last year). Some of those circumstances were, a new version of iOS/Xcode etc was released, changes in flutter tooling, behaviour between master and beta channels. Did tests break when a new version of xcode was released, etc. 

Over time, I got really good at it, to the point where, I automated most of it. Mainly the tests; there were hundreds of them, monitoring them individually did not make sense. I setup a script that would run the tests, write the output into a log file and then read that when it failed to see why it did. I would then re-run it to make sure it wasn't flaky before filing a report. It was fun while it lasted. 

We also setup an internal tool to help us with finding duplicate issues. I believe we would have made a lot of headway this year, but, all good things must come to an end. 

### Impact? 

I often wonder, did the work we do have any impact? Metrics-wise, it appeared to. Issues were responded to quickly, closed quickly (if need be), authors generally appeard satisfied with our responses, but not always (you can't please everybody). It often felt good seeing people respond to an issue you triaged with something like, "Thanks man, you saved my ass" but then there'd be the occasional angry internet guy. I learnt a lot from both camps. It helped me grow as an individual and to be honest, this experience is one that I wouldn't trade for anything. The people we worked with also generally seemed happy/satisfied with our work, but there was always that nagging feeling, that maybe, we weren't making as much of an impact as we thought (especially in light of the contract termination, but that was above their paygrade, so, nothing much to say there).

### What's Next?

I used to do a lot of side quests during my time as OSSE. I worked on Java(Spring-Boot)/Kotlin(Native-Android)/Flutter projects as a freelance Software Engineer (some of which I've written about on this site, go check them out). I guess you could say, I'm still taking on side quests. I've been dabbling in Tauri(Rust), NestJS, Python, Flutter, React Native, Golang projects since February. I'm looking for a new engagement. I've been searching, but the job market is terrible right now.

I don't think AI is to blame, I think corporations are just scape-goating it. I'm not saying this as an Anti-AI developer. The work I've done since February has only been possible because of AI and the velocity it has given me. I don't think it's fair tho, for the velocity to be used as a reason to downsize, but, what do I know? 

### Conclusion...?

If any of this feels incoherent, that is by design. I could use an AI tool to clean it, tighten it up in places, etc, but I wanted this to feel human.

If you know of any remote opportunities or if you're hiring, I would appreciate a referral, my email is danagbemava@gmail.com. This blog/portfolio site wasn't meant for this. It was meant to showcase skills, projects, posts, experiences, etc, but I guess, every once in a while, something like this isn't bad.

Until next time, my name is Daniel Agbemava (GH: [danagbemava-nc](https://github.com/danagbemava-nc)/[danagbemava](https://github.com/danagbemava))
