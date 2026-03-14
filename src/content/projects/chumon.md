--- 
layout: page
title:  "Chumon"
permalink: /projects/chumon
---

### Summary
Chumon is a mobile e-commerce platform for healthcare products built with Flutter. The app enables users to browse and purchase medical equipment, personal care products, prescriptions, and supplements through a structured catalog system. It connects to a REST API backend and supports real-time order tracking, push notifications, and secure payment processing. The platform targets both iOS and Android with a responsive Material Design 3 interface.


---

## My Role

**Name:** Daniel Agbemava

**Role:** Lead Mobile Developer

- Primary contributor with the majority of commits 
- Responsible for core architecture, feature implementation, and code quality
- Key contributions include: app scaffolding, Firebase integration, product catalog, cart/checkout flows, state management setup, UI refinements, and deployment configurations
- Collaborates with Pius Ikeoffiah who contributes KYC features, product UI fixes, and bug fixes

---

## Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Flutter 3.7.0+ (Dart) |
| **State Management** | Hooks Riverpod 2.6.1 + ChangeNotifier |
| **Networking** | Dio 5.7.0 (with token & auth interceptors) |
| **Local Storage** | Hive CE 2.8.0 (AES-encrypted) |
| **Secure Storage** | Flutter Secure Storage |
| **Real-time** | Pusher Channels 2.4.0 |
| **Push Notifications** | Firebase Cloud Messaging + Local Notifications |
| **Analytics/Crashes** | Firebase Analytics + Crashlytics |
| **Navigation** | Routemaster 1.0.1 |
| **DI** | GetIt (Service Locator) |
| **Serialization** | dart_mappable |

### Architectural Pattern

Modular feature-based architecture with a service layer pattern:

```
lib/
├── core/                          # Feature modules
│   ├── auth/                      # Authentication (OTP-based)
│   │   ├── models/
│   │   ├── screens/
│   │   ├── services/
│   │   ├── controllers/
│   │   └── widgets/
│   ├── home/                      # Home/dashboard
│   ├── products/                  # Product catalog & search
│   ├── cart/                      # Shopping cart & checkout
│   ├── favorites/                 # Wishlist (local persistence)
│   ├── onboarding/                # Splash, onboarding, genre selection
│   ├── utility/                   # Account, orders, addresses, payments, KYC
│   └── base_screen.dart           # Bottom tab navigation shell
│
├── shared/                        # App-level services & state
├── utils/                         # Config & utilities
├── main.dart                      # Entry point
└── firebase_options.dart          # Firebase config
```

### Data Flow

```
UI (Screens/Widgets)
    ↕
Controllers (ChangeNotifier via Riverpod)
    ↕
Services (API calls via Dio)
    ↕
REST API (api-staging.121online.org/api/v1)
    ↕
Local Cache (Hive CE - encrypted)
```


### Platform Support

| Platform | Config |
|----------|--------|
| **Android** | Kotlin, Java 17, Core Library Desugaring, Google Services |
| **iOS** | CocoaPods, Flutter iOS Plugins |
| **Firebase** | Crashlytics, Analytics, FCM |

---

## Features

- Authentication & Onboarding
- Product Catalog
- Shopping Cart & Checkout
- Payments
- Orders
- User Account
- Favorites / Wishlist
- Notifications
