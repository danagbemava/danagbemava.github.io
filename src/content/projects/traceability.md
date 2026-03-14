--- 
layout: page
title:  "Shea Traceability Project"
permalink: /projects/traceability
---

# Traceability Mobile

## Summary

Traceability Mobile is a production-grade Flutter monorepo implementing an agricultural supply chain traceability platform. The system tracks commodities from farmers and producers through warehouses to end-users, providing complete batch management, inventory control, and provenance tracking. It consists of two specialized mobile applications — **Field Agent** (for producers and agricultural cooperatives) and **Warehouse Manager** (for logistics and warehouse operations) — that share a common backend, widget, and utility layer through a Melos-managed monorepo structure.

The platform targets agricultural supply chains, enabling field agents to register farmers, manage cooperatives, create batches, and scan goods via NFC, while warehouse managers handle batch receiving, goods movement between warehouses, vendor management, and scanner-based inventory operations via Bluetooth and audio-jack scanners.

---

## My Role

- Designed and implemented the full Flutter monorepo architecture across two mobile applications and three shared packages
- Built the offline-first data layer using Hive with intelligent sync to a REST backend via Dio
- Implemented MVVM architecture with Riverpod state management, GetIt dependency injection, and Freezed immutable models
- Developed hardware integration features including NFC scanning, Bluetooth Classic/BLE scanner connectivity, GPS location capture, and camera-based image handling
- Created the shared authentication flow (JWT-based), profile management, and notification system in the common package
- Built responsive layouts supporting both mobile and tablet form factors
- Integrated Firebase Crashlytics for production error monitoring
- Managed the full feature lifecycle for batch management, goods tracking, farmer/cooperative registration, vendor management, and warehouse-to-warehouse goods movement

---

## Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Flutter (Dart) |
| State Management | Riverpod (Hooks), StateNotifier, ChangeNotifier |
| Navigation | Routemaster (declarative) |
| Networking | Dio with interceptors, JWT auth |
| Local Storage | Hive (NoSQL), Flutter Secure Storage |
| Code Generation | Freezed, json_serializable, build_runner |
| DI | GetIt (service locator) |
| Crash Reporting | Firebase Crashlytics |
| Monorepo | Melos |

### Project Structure

```
traceability_mobile/
├── melos.yaml
├── analysis_options.yaml
├── projects/
│   ├── field_agent/              # Field agent mobile app
│   └── warehouse_manager/        # Warehouse manager mobile app
└── packages/
    ├── traceability_backend/     # API services, models, DAOs, config
    ├── traceability_common/      # Shared screens & utilities
    └── traceability_widgets/     # Custom UI components
```

### Layered Architecture

```
Presentation (Screens - HookConsumerWidget)
        ↓
ViewModel (BaseChangeNotifier / StateNotifier)
        ↓
Repository (Online + Offline abstraction)
        ↓
Service (API calls, business logic)
        ↓
DAO (Hive local storage)
        ↓
Models (Freezed, JSON serializable, Hive adapters)
```

### Key Patterns

- **MVVM**

- **Repository Pattern** — Repositories bridge services and DAOs, handling online/offline scenarios
- **Service Locator** — GetIt registers singletons and lazy singletons
- **Offline-First** — All entities cached in Hive; data pre-fetched on auth; background sync
- **Code Generation** — Freezed for immutable models with `copyWith`, pattern matching, and Hive type adapters

### Domain Models

All models are immutable (Freezed), JSON-serializable, and Hive-persistent.

---

## Features

### Field Agent App

| Feature | Description |
|---|---|
| **Authentication** | Login, registration, email verification (JWT-based) |
| **Dashboard** | Overview of farmer, cooperative, and batch activity |
| **Farmer Management** | CRUD operations for individual farmers with GPS location capture and image uploads |
| **Cooperative Management** | Register and manage cooperatives, assign farmers to cooperatives |
| **Warehouse Management** | Create and manage warehouses, assign warehouse managers |
| **Batch Management** | Create, edit, receive batches; scan goods via NFC; view batch history and received batches |
| **Goods Management** | Register goods, assign to batches, individual sales unit identification |
| **NFC Scanning** | Tag reading for product identification and batch item linking |
| **Profile & Settings** | View/edit profile, change password, notifications |
| **Geolocation** | GPS capture for farmer and warehouse registration |
| **Image Handling** | Photo capture with compression for profiles and goods |

### Warehouse Manager App

| Feature | Description |
|---|---|
| **Authentication** | Login, registration, email verification (JWT-based) |
| **Dashboard** | Overview of batch receiving and goods movement |
| **Vendor Management** | CRUD operations for suppliers/vendors with organization profiles |
| **Batch Management** | Create, receive, and track batches; view received batch details and moved goods |
| **Scanner Integration** | Bluetooth Classic, BLE, and audio-jack scanner support with device pairing management |
| **Goods Movement** | Transfer goods between warehouses with vehicle details and waybill tracking |
| **RFID Scanning** | RFID scanner utilities for inventory operations |
| **Profile & Settings** | View/edit profile, change password, notifications |

### Shared Capabilities (Common Package)

| Feature | Description |
|---|---|
| **Offline-First** | Full Hive-based local persistence with background sync |
| **Responsive UI** | Adaptive layouts for mobile (480px) and tablet (800px+) |
| **Connectivity Monitoring** | Real-time network status detection with graceful degradation |
| **Crash Reporting** | Firebase Crashlytics integration for production error telemetry |
| **Tag Scanner** | Shared NFC/barcode tag reading screen |
| **ID Scanner** | Document ID scanning page |
| **Notifications** | In-app notification system |
