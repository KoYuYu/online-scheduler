# Online Scheduler

RWD online booking system with public 60-minute slots, Zoom invitation parsing, PDF attachment storage, admin calendar controls, PostgreSQL storage, and email notifications.

## Features

- Public booking page without login.
- Default availability: Monday-Friday 8:00 PM-12:00 AM ET; Saturday-Sunday 10:00 AM-1:00 PM and 7:00 PM-12:00 AM ET.
- Manual public booking requires a name and Zoom link; email is not required.
- Public Zoom invite parser with confirmation before any booking is created.
- Optional PDF upload is stored with the booking in the database.
- Admin login for full booking details, Zoom links, deletion, and availability rules.
- Public calendar shows available and anonymous blocked slots without exposing booking details.
- Eastern Time display with UTC storage.
- Railway-ready Postgres migration script.

## Local Development

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:3000`.

Without `DATABASE_URL`, local development uses `.data/scheduler.json` with an in-memory fallback if the local filesystem is locked. The local default admin also works when running the production standalone server without `DATABASE_URL`:

```text
admin@example.com
password123
```

If OneDrive locks local JSON writes, set `LOCAL_DATA_PATH=C:/tmp/online-scheduler-local.json`.

## Tests

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

## Railway Deployment

1. Create a Railway project.
2. Add a PostgreSQL database.
3. Deploy this repo as the Next.js service.
4. Add a reference variable from the Postgres service: `DATABASE_URL`.
5. Set service variables from `.env.example`, especially:
   - `AUTH_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `NOTIFY_TO_EMAIL=jasonko12033@gmail.com`
   - SMTP variables if email should send from Gmail.
6. Set Railway pre-deploy command:

```bash
npm run db:migrate
```

7. Deploy and generate a public domain.

For Gmail SMTP, create a Google App Password and put it in `SMTP_PASS`. Do not use your normal Gmail password.
