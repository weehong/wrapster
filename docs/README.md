# Wrapster Technical Documentation

## Overview

**Wrapster** is a packaging tracking and management application designed for warehouse and logistics operations. It enables users to scan waybills and product barcodes, track packaging details, manage inventory with stock levels, and export reports in multiple formats.

## Table of Contents

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | System architecture, tech stack, and design patterns |
| [Database](./DATABASE.md) | Database schema, models, and data relationships |
| [API Reference](./API.md) | API endpoints, services, and backend integration |
| [Features](./FEATURES.md) | Detailed feature documentation and workflows |
| [Deployment](./DEPLOYMENT.md) | Deployment configuration and environment setup |
| [Development](./DEVELOPMENT.md) | Development guide, setup, and contribution guidelines |

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Appwrite credentials

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

## Key Features

- **Product Management**: CRUD operations for single and bundle products with barcode tracking
- **Waybill Scanning**: Scan and track waybills with duplicate prevention
- **Stock Management**: Real-time inventory tracking with automatic deduction
- **Report Generation**: Export packaging reports to Excel or PDF
- **Email Delivery**: Send reports directly to email recipients
- **Background Jobs**: Async processing for import/export operations
- **Internationalization**: English and Chinese language support

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS |
| UI Components | shadcn/ui, Radix UI |
| State Management | TanStack Query, React Context |
| Backend | Appwrite (BaaS) |
| Job Queue | Trigger.dev |
| Email | Resend |
| Testing | Vitest, Playwright |
| Build | Vite |

## Project Structure

```
wrapster/
├── src/                    # Frontend source code
│   ├── pages/              # Page components
│   ├── components/         # Reusable components
│   ├── hooks/              # Custom React hooks
│   ├── contexts/           # React context providers
│   ├── lib/                # Utilities and services
│   └── types/              # TypeScript definitions
├── trigger/                # Background job tasks
├── functions/              # Appwrite cloud functions
├── scripts/                # Database and utility scripts
├── __tests__/              # Unit tests
├── e2e/                    # End-to-end tests
└── docs/                   # Documentation
```

## Support

For issues and feature requests, please use the project's issue tracker.
