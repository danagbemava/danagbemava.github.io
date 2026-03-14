---
layout: page
title:  "Presto"
permalink: /projects/presto
---

## Summary

Presto is a mobile food ordering and delivery application built with Flutter for a client in the e-commerce/food delivery space. The app enables users to browse restaurant menus, customize orders, manage delivery addresses, and track orders in real-time. It supports multiple payment methods and integrates with a REST API backend for menu data, order management, and delivery coordination.

---

## My Role

**Lead Mobile Developer**

- Built the Flutter mobile application from the ground up, targeting both iOS and Android
- Implemented the restaurant browsing and menu navigation with category filtering and search
- Built the cart and checkout flow with item customization (sizes, add-ons, special instructions)
- Integrated delivery address management with Maps SDK for address selection and geocoding
- Implemented real-time order status tracking with push notifications
- Set up local data persistence with Hive for cart state, recent orders, and user preferences
- Managed state across the application using Riverpod

---

## Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Flutter (Dart) |
| **State Management** | Riverpod |
| **Local Storage** | Hive (encrypted) |
| **Networking** | Dio with interceptors |
| **Navigation** | Named routes |
| **Notifications** | Firebase Cloud Messaging |

### App Structure

```
lib/
├── features/
│   ├── auth/              # Login, registration, profile
│   ├── home/              # Restaurant listing, search, categories
│   ├── restaurant/        # Menu browsing, item detail
│   ├── cart/              # Cart management, checkout
│   ├── orders/            # Order history, real-time tracking
│   ├── addresses/         # Delivery address management
│   └── settings/          # Preferences, notifications
├── shared/                # Common widgets, themes, constants
├── services/              # API client, local storage, notifications
└── main.dart
```

---

## Features

- **Restaurant Discovery** — Browse nearby restaurants with category filters, search, and featured listings
- **Menu & Customization** — View menus with item images, descriptions, and customization options (sizes, extras, notes)
- **Cart & Checkout** — Multi-restaurant cart with order summary, delivery fee calculation, and payment method selection
- **Address Management** — Save and manage delivery addresses with map-based location picking
- **Order Tracking** — Real-time order status updates from confirmation through delivery
- **Push Notifications** — Order status updates, promotions, and delivery alerts via FCM
- **Offline Support** — Cart state and recent orders persist locally via Hive
