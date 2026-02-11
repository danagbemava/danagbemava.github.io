---
layout: post
title:  "The wrong way to handle multiple apps in a single project"
date:   "2024-01-17"
categories: mobile code-organization architecture
---

### Background 

Last year, I wanted to get back into native android development because it had been a while since I did anything on the native side. I stopped native android when I started using flutter in 2019. The ease of use for flutter and low barrier to entry made it much more appealing. What I particularly didn't like about native android was that creating a list required so much work, but I digress. One of my freelance clients/friends reached out to me that he needed someone to push a small update for one of his projects for which the actual developer was no longer available. Since this aligned with my goal, I decided to jump at the opportunity. 

### Getting into it

I got access to the source code so I could go through what needed to be done and it immediately became clear to me that while the changes I needed were straightforward, actually implementing it would be anything but. It turned out the project was to be 3 separate apps but because they shared quite a lot of similar UI code, the developer decided to write only one app, but then use flavors and if-statements to implement features for various apps. 

On the face of it, there doesn't seem to be an issue with this and a few years ago, I might have done the same thing (this was an old project, so perhaps that was why it was done this way) but at the time I was working on the project, it led too many things to be desired. 

### Why was this an issue?

For one thing, the code organization itself was not the best so it was difficult to navigate