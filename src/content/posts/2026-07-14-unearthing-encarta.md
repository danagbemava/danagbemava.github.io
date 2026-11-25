---
layout: post
title:  "Unearthing Encarta"
date:   "2026-07-14"
categories: Reverse-Engineering Microsoft Encarta
status: incomplete
---

## Introduction

Growing up, Microsoft Encarta was one of my favorite ways of learning new things, particularly about history, arts, sciences and stuff like that. It was discontinued in 2009. I used to to thing about it every once in a while but never went beyond that. 

Fast forward to about a month ago, I was having a conversation with my nephew about old software, such as WMP (Windows Media Player); and how the skins could be anything the user wanted so far as they were creative enough and how encarta made learning fun (at least for me). It was then that I decided, "I'm going to reverse engineer encarta and rebuild it", mainly as an exercise to see if it was possible. 

## The Process

I first got a Microsft Encarta iso (it's easy to find on the internet) and run it on windows 11 to see if it would even work at all. To my surprise, it worked, and it didn't even need a compatibility layer to run (albeit windows did suggest running it through one). 

> A compatibility layer allows applications that were developed on older versions of windows to run on the latest version of windows. Windows handles the translation of APIs from the old version to the new version automatically, so the user can use the app as though it was meant to run on the version of the OS they are using.

Since it worked on Windows 11, I knew then that there was a chance that this effort would most likely not be in vain. 


### Understanding the formats

The goal with this endeavor was to get the full content library because teh content is what I mainly interested in. In particular, the content I wanted was the articles, 3d tours and the MindMaze trivia game. 

Those were the things I enjoyed
