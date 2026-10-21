# Stock Inventory System

**PostgreSQL + Node.js (Express) + React (Vite)**

Multi-branch stock system with:

- Stock Master (auto current stock)
- Transaction Log (fixed date/time, Taken By + Recorded By separate)
- IC / Serial registry for **phones, monitors, printers**
- Branch analysis, monthly usage, ranking, category summary
- **Roles**: `admin` can create/edit/delete everything (items, transactions, serials, branches, users). `user` can only view.

Your Excel seed data (branches, items, sample transactions) is included in `database/schema.sql`.

---

## Requirements

- Docker (for PostgreSQL) **or** local PostgreSQL 14+
- Node.js 18+

---

## 1. Start database

```bash
cd stock-system
docker compose up -d
```

This creates DB `stock_inventory`, user `stock` / `stockpass`, and loads the schema + seed data.

---

## 2. Backend API

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API: **http://localhost:4000**

Health check: `GET /api/health`

---

## 3. React frontend

```bash
cd frontend
npm install
npm run dev
```

UI: **http://localhost:5173**  
Vite proxies `/api` → `http://localhost:4000`.

---

## API overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/items` | Stock master (with current qty) |
| POST | `/api/items` | Add item |
| GET | `/api/branches` | List branches |
| GET | `/api/transactions` | Transaction log |
| POST | `/api/transactions` | Create movement (stamps fixed date/time from body) |
| PUT | `/api/transactions/:id` | Edit movement |
| DELETE | `/api/transactions/:id` | Delete |
| GET | `/api/serials` | Serial registry |
| POST | `/api/serials` | Register IC for on-hand stock |
| PATCH | `/api/serials/:id` | Mark In Stock / Taken Out |
| GET | `/api/reports/branch-analysis` | Item × branch |
| GET | `/api/reports/monthly?year=&month=` | Monthly usage |
| GET | `/api/reports/ranking` | Branch ranking |
| GET | `/api/reports/by-category` | Category summary |

---

## Notes

- **Date/time** are stored as columns on each transaction (not `NOW()`), so they never change after save.
- **Taken By** vs **Recorded By** are separate fields.
- **Taken By** is optional on all transactions (including phones, monitors, printers).
- Serials can be registered without a transaction (stock already on hand).
- Take Out / Add Stock with a serial updates the registry automatically.

---

## Project layout

```
stock-system/
  database/schema.sql
  docker-compose.yml
  backend/          # Node + Express + pg
  frontend/         # React + Vite
  README.md
```
