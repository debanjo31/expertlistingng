# Property Listings API

A small REST API for creating and searching property listings. It supports CRUD operations, pagination, structured validation, geographic radius searches, and short-lived Redis caching.

## Technology choices

- **TypeScript and NestJS** provide clear module boundaries, dependency injection, DTO-based validation, and a structure that remains maintainable as the API grows.
- **PostgreSQL with PostGIS** keeps listing data and geographic queries in one reliable datastore. `ST_DWithin` uses the spatial index for radius searches, while the `geography` type returns distances in metres and handles the earth's curvature.
- **TypeORM** provides repository-based persistence and explicit migrations without hiding the PostGIS SQL needed for the search endpoint.
- **Redis** caches repeated search results for 60 seconds. A versioned cache key invalidates all search variants after a listing changes without using expensive key scans.

## Requirements

- Node.js 20 or newer
- npm
- Docker with Docker Compose

## Setup

1. Install dependencies and create the local environment file:

   ```bash
   npm install
   cp .env.example .env
   ```

   On PowerShell, use `Copy-Item .env.example .env` instead of `cp` if needed.

2. Start PostgreSQL/PostGIS and Redis:

   ```bash
   docker compose up -d
   ```

3. Run the database migration:

   ```bash
   npm run migration:run
   ```

4. Start the API:

   ```bash
   npm run start:dev
   ```

The API is available at `http://localhost:3000/api/v1`. The [api.http](api.http) request collection can be run with the VS Code REST Client extension or an IDE with built-in HTTP client support. Run the create request first; the remaining CRUD requests reuse its response ID.

## API overview

| Method   | Endpoint                    | Purpose                                                                   |
| -------- | --------------------------- | ------------------------------------------------------------------------- |
| `POST`   | `/listings`                 | Create a listing                                                          |
| `GET`    | `/listings?page=1&limit=20` | List properties with pagination                                           |
| `GET`    | `/listings/:id`             | Get one listing                                                           |
| `PATCH`  | `/listings/:id`             | Update one or more listing fields                                         |
| `DELETE` | `/listings/:id`             | Permanently delete a listing                                              |
| `GET`    | `/listings/search`          | Search within a radius and optionally filter by type, price, and bedrooms |

The search endpoint requires `latitude`, `longitude`, and `radiusKm`. Optional parameters are `type`, `minPrice`, `maxPrice`, `bedrooms`, `page`, and `limit`. Collection responses contain `data` and pagination `meta`; search items also include `distanceKm`.

## Available commands

| Command                    | Purpose                                       |
| -------------------------- | --------------------------------------------- |
| `npm run start:dev`        | Start the API with file watching              |
| `npm run build`            | Compile the production build                  |
| `npm run start:prod`       | Run the compiled build                        |
| `npm run migration:run`    | Apply pending migrations                      |
| `npm run migration:revert` | Revert the latest migration                   |
| `npm test`                 | Run unit tests                                |
| `npm run test:e2e`         | Run integration tests against Docker services |
| `npm run test:cov`         | Run unit tests with coverage                  |
| `npm run lint`             | Check TypeScript with ESLint                  |

The e2e suite uses the dedicated `expert_listings_test` database created when the PostgreSQL container is first initialized. Docker services must be running before `npm run test:e2e`.

## Design notes

The HTTP representation uses `location: { lat, lng }`, while PostgreSQL stores it as a `geography(Point, 4326)`. Longitude is the first coordinate in the database's GeoJSON value; that conversion is kept inside the service so API consumers do not need to know the persistence format.

Schema synchronization is disabled. The migration enables PostGIS, creates the enum and listings table, and adds both a GiST location index and an index for common filters. Prices are non-negative whole NGN amounts and use `numeric(15, 0)` to avoid a 32-bit integer ceiling.

Redis is treated as an optimization rather than a system of record. If it is unavailable, requests continue against PostgreSQL. Successful creates, updates, and deletes increment a cache version, so subsequent searches use a new key while older entries expire after their TTL.

Validation is applied globally. Unknown properties are rejected, query-string numbers are converted and checked, and errors use one consistent response shape. Deletes are permanent, and `agentId` is validated as a UUID but is not a foreign key because agent management is outside this assignment.

## What I would improve with more time

- Add authentication and authorization so agents can manage only their own listings.
- Add currency, amenities, descriptions, photos, availability dates, and a real agents table with a foreign-key relationship.
- Use cursor pagination for large result sets and add search-ranking options.
- Add more edge-case tests for invalid price ranges, radius limits, pagination boundaries, Redis outages, empty PATCH bodies, and malformed UUIDs.
- Support an `Idempotency-Key` header for listing creation so safely retried requests do not create duplicate listings.
- Add rate limiting, request IDs, structured logging, secure configuration validation, and CORS configuration.
- Add metrics and production health checks.
- Add CI for linting, tests, migrations, and container builds.
- Add more targeted cache invalidation if search volume justifies the added complexity.
