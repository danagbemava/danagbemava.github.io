--- 
layout: page
title:  "Fluxx"
permalink: /projects/fluxx
---

### Summary

Fluxx is a comprehensive fintech mobile application built with Flutter, targeting iOS and Android platforms. It provides digital banking services including wallet management, bill payments (airtime, data, electricity, TV), peer-to-peer and bank transfers, virtual card management, stock/investment trading, insurance products, loan services, and health subscriptions. The app integrates with multiple third-party services including Firebase (analytics, crashlytics, messaging), Smile ID (biometric KYC verification), Fincra (banking/deposits), and Wella Health (health plans). It supports English and French localization, light/dark theming, and biometric authentication.

---

## My Role

- Developing and maintaining the Flutter mobile application across iOS and Android
- Implementing new features across the investment, marketplace, and home modules
- Migrating state management to Riverpod-based view models
- Building stock trading features (search, quotes, buy/sell orders, portfolio tracking)
- Integrating marketplace services (loans, insurance, investments, health subscriptions)
- Working with REST API microservices (auth-service, finops-service, validation-service, marketplace-service)
- Maintaining CI/CD pipelines for Firebase App Distribution and TestFlight

---

## Architecture

### Tech Stack

| Layer              | Technology                                                     |
| ------------------ | -------------------------------------------------------------- |
| Framework          | Flutter SDK ^3.10.0, Material Design 3                        |
| State Management   | Riverpod (hooks_riverpod) with StateNotifier & ChangeNotifier  |
| Dependency Injection | GetIt (service locator pattern)                              |
| Networking         | Chopper (REST client with code generation)                     |
| Local Storage      | Hive CE (encrypted) + Flutter Secure Storage                   |
| Serialization      | Dart Mappable (code-generated JSON mapping)                    |
| Navigation         | Named routes with MaterialPageRoute                            |
| Firebase           | Core, Analytics, Crashlytics, Cloud Messaging                  |
| Localization       | intl (English, French)                                         |
| Code Generation    | build_runner, chopper_generator, hive_ce_generator             |

### Project Structure

```
lib/
├── core/
│   ├── auth/                    # Authentication & onboarding (18 screens)
│   │   ├── screens/             # Login, register, OTP, PIN, KYC flows
│   │   ├── models/              # User, Identity, UserTier
│   │   ├── view_models/         # Riverpod providers & state notifiers
│   │   ├── states/              # Sealed state classes (Idle/Requesting/Success/Failed)
│   │   ├── widgets/             # Reusable auth UI components
│   │   └── auth_repo.dart       # Auth API repository
│   │
│   └── main/                    # Authenticated app features
│       ├── home/                # Home tab
│       │   ├── investment/      # Stock trading module
│       │   ├── screens/         # Transactions, bills, transfers, community
│       │   ├── view_models/     # Feature providers
│       │   ├── models/          # Domain models
│       │   ├── repo/            # API repositories
│       │   └── widgets/         # UI components
│       │
│       ├── marketplace/         # Marketplace tab (loans, insurance, investments)
│       ├── wallet/              # Wallet tab (balances, funding, swaps)
│       ├── cards/               # Virtual cards tab (CRUD, freeze, fund)
│       ├── profile/             # Profile & settings tab
│       ├── notifications/       # Notifications screen
│       ├── support/             # Support tickets & FAQ
│       └── base_screen.dart     # Bottom navigation scaffold
│
├── shared/
│   ├── config/                  # API config, DI setup, database init
│   ├── services/                # Chopper API services, Firebase, notifications
│   ├── states/                  # Global auth state provider
│   └── widgets/                 # Shared UI components
│
├── utils/                       # Router, theme, interceptors, helpers
├── l10n/                        # Localization files (en, fr)
├── main.dart                    # App entry point
└── firebase_options.dart        # Firebase config
```

### Backend Integration

The app connects to a microservices backend via Chopper API services.

Request pipeline includes token injection, error handling, and structured logging via custom interceptors.

### Key Patterns

- **State machines** with sealed classes for async operations (Idle → Requesting → Success/Failed)
- **Repository pattern** separating API calls from business logic
- **Code generation** for serialization, API clients, and Hive adapters
- **Encrypted local storage** with Hive CE + secure key management
- **Session management** with 15-second background auto-lock and biometric re-auth

---

## Features

- Authentication & Security
- Wallet & Transactions
- Bill Payments
- Money Transfers
- Virtual Cards
- Stock & Investment Trading
- Loans
- Insurance
- Investments
- Wella Health
- Community
- Profile & Settings
- Support
