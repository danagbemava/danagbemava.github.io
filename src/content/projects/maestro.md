--- 
layout: page
title:  "Maestro"
permalink: /projects/maestro
---

### Summary
Maestro is a mobile application that helps farmers manage their farms. It is a software solution that helps farmers manage their farms, from ordering and inventory to customer service and reporting.

### My Role
My role in this project was to handle the mobile applications for this project. The mobile applications were built using Flutter and Dart.
There were 3 mobile applications in this project 

1. Maestro Mobile App
2. Maestro POS App
3. Maestro Driver/Rider App

### Architecture

The applications shared the same backend and as such to make this easy for me to maintain, I used a shared package for the backend.
I also also opted to use a monorepo so that I can manage the codebase more easily.

```text
Maestro
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
