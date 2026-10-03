# Expense Tracker

Track income and expenses, set monthly budgets and savings goals, and view reports. Each user has their own account, and all data is saved in a database so it's available on any device.

**Stack:** HTML, CSS, JavaScript, Chart.js · Node.js + Express · TiDB Cloud (MySQL-compatible) · deployed on Render

## Features

- Sign up / log in (passwords hashed with bcrypt, sessions in an httpOnly cookie)
- Add, edit, delete, search and filter transactions
- Dashboard, reports and charts
- Monthly budget and savings goal
- Custom categories
- CSV import/export and JSON backup/restore
- Dark mode
- If you used the old browser-only version, your saved data is offered for import into your account on first login

## Project structure

```
public/          Frontend (index.html, login.html, css/, js/)
server/
  index.js       Express app: static files, page routing, error handling
  auth.js        Signup / login / logout / session
  api.js         Transactions and settings API
  db.js          TiDB connection pool and table creation
render.yaml      Render deployment blueprint
```

Tables are created automatically on first start.

## Run locally

1. Install Node.js 18+.
2. Create a free cluster on [TiDB Cloud](https://tidbcloud.com) (Serverless tier).
3. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `JWT_SECRET`.
4. Install and start:

   ```bash
   npm install
   npm run dev
   ```

5. Open http://localhost:3000.

## Deploy on Render

1. Push this repository to GitHub.
2. In TiDB Cloud, open your cluster → **Connect** → choose **General** connection and copy the connection string. Make sure it includes a database name (e.g. `/expense_tracker`; create it with `CREATE DATABASE expense_tracker;` in the SQL editor), or use the default `test` database.
3. In Render, choose **New → Blueprint**, select this repository, and Render will read `render.yaml`.
4. When asked, paste the TiDB connection string as `DATABASE_URL`. `JWT_SECRET` is generated automatically.
5. Deploy. Your app will be live at `https://expense-tracker-xxxx.onrender.com`.

> Render's free plan sleeps after 15 minutes of inactivity, so the first request after a pause can take ~30–60 seconds.

## API

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create an account `{ name, email, password }` |
| POST | `/api/auth/login` | Log in `{ email, password }` |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/auth/me` | Current user |
| GET | `/api/data` | All transactions and settings for the current user |
| POST | `/api/transactions/sync` | Save changes `{ upsert: [...], remove: [ids] }` |
| PUT | `/api/settings` | Save `{ monthlyBudget, savingsGoal, customCategories }` |

## Author

Aditya Maurya
