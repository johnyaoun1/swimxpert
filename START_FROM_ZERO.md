# SwimXpert Fresh Backend + DB Setup

## 1) Start PostgreSQL

Run from project root:

```bash
cd /Users/johnyaoun/Desktop/swimxpert
docker compose down -v
docker compose up -d
```

## 2) Restore and build backend

```bash
cd /Users/johnyaoun/Desktop/swimxpert/SwimXpert.Api
dotnet restore
dotnet build
```

## 3) Run backend

```bash
dotnet run
```

Backend URL: `http://localhost:5002`

## 4) Quick tests

- Health: `GET http://localhost:5002/api/health`
- Login (default seeded admin):
  - Email: `admin@swimxpert.com`
  - Password: `admin123`
  - Endpoint: `POST http://localhost:5002/api/auth/login`

## Notes

- Docker DB credentials: `postgres` / `postgres`
- DB name: `swimxpert_db`
- API connection string is in `SwimXpert.Api/appsettings.json`
