--- 
layout: page
title:  "Locqar v2"
permalink: /projects/locqar-v2
status: incomplete
---

### Summary
Locqar v2 is a mobile application that helps users find and book locations. It is a software solution that helps users find and book locations, from ordering and inventory to customer service and reporting.

### My Role
My role in this project was to handle the mobile applications for this project. The mobile applications were built using Flutter and Dart.
There were 3 mobile applications in this project 

1. Locqar v1 Mobile App
2. Locqar v1 POS App
3. Locqar v1 Driver/Rider App

### Architecture

The applications shared the same backend and as such to make this easy for me to maintain, I used a shared package for the backend.
I also also opted to use a monorepo so that I can manage the codebase more easily.

```text
Locqar v1
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
