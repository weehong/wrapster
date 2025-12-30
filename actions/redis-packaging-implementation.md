# Objective
Implement a "Cache-Aside" pattern for the Packaging page to optimize historical data retrieval using Redis.

# Context
We currently read all packaging data from the Appwrite Database. As data grows, fetching historical records becomes slow. We want to use Redis to cache past dates, while keeping the current date live in the database for real-time editing.

# Tech Stack Requirements
- **Database:** Appwrite (Source of Truth)
- **Cache:** Redis (External instance, e.g., Upstash) using `ioredis`
- **Cron Job:** Trigger.dev (Utilizing existing integration in `trigger/`)

# Detailed Instructions

## 1. Infrastructure & Utility (`src/lib/redis.ts`)
- Install `ioredis` (`npm install ioredis`).
- Create a singleton Redis client in `src/lib/redis.ts`.
- Ensure it reads connection strings from environment variables (`REDIS_URL`).
- Export helper functions: `getDailyPackagingCache(dateString)` and `setDailyPackagingCache(dateString, data)`.

## 2. The Housekeeping Cron Job (`trigger/packaging-archival.ts`)
- Create a new Trigger.dev scheduled task that runs every day at 00:00:00.
- **Logic:**
    1. Calculate "Yesterday's" date string (YYYY-MM-DD).
    2. Query Appwrite Database for all packaging records created on that date.
    3. Serialize the result set.
    4. Store it in Redis using the key format `packaging:history:YYYY-MM-DD`.
    5. Log the archival status.

## 3. Data Fetching Refactor (`src/lib/appwrite/packaging.ts`)
- Refactor how packaging records are retrieved to support the dual-source strategy.
- **Method:** `getPackagingByDate(date: Date)`
- **Logic:**
    - **IF date is TODAY:**
        - Query Appwrite Database directly to ensure real-time editing capabilities.
    - **IF date is in the PAST:**
        - Attempt to fetch from Redis first (via a secure proxy or Appwrite Function).
        - **Fallback:** If Redis is empty or fails, query Appwrite Database and update the Redis cache.

## 4. Frontend Integration (`src/pages/Packaging.tsx`)
- Update the UI to use the new `getPackagingByDate` logic.
- Ensure the "Edit" functionality is conditionally disabled or strictly managed based on the date (Current date = Editable until 23:59:59).

## 5. Environment Configuration
- Update `.env.example` with `REDIS_URL`.

# Acceptance Criteria
1. Current day records remain in Appwrite and are fully editable.
2. Historical records are served from Redis for significantly faster load times.
3. The Trigger.dev cron job successfully "warms up" the Redis cache every midnight.
4. Data integrity is maintained: Redis acts as a cache, while Appwrite remains the permanent source of truth.
