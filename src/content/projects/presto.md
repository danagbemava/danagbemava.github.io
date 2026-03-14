--- 
layout: page
title:  "Presto"
permalink: /projects/presto
---

### Summary
Presto is a multi-tenant restaurant management system. It is a software solution that helps restaurants manage their operations, from ordering and inventory to customer service and reporting.


### My role
My role in this project was to handle the mobile applications for this project. The mobile applications were built using Flutter and Dart.
There were 3 mobile applications in this project 

1. Presto Mobile App
2. Presto POS App
3. Presto Driver/Rider App

### Architecture

The applications shared the same backend and as such to make this easy for me to maintain, I used a shared package for the backend.
I also also opted to use a monorepo so that I can manage the codebase more easily.


```text
Presto
├── POS App
├── Mobile App
├── Driver/Rider App
└── Backend
    ├── api
    ├── config
    ├── db
    ├── interceptors
    └── shared
```


### Technologies used
- Flutter
- Dart
- Hive
- Riverpod
- Sentry


### Related Posts 
- [Debugging an OOM crash in Flutter](/posts/2023-12-30-debugging-an-oom-crash-in-flutter)

