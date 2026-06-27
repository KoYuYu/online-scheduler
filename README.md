# Online Scheduler

RWD online booking system with public 60-minute slots, Zoom invitation parsing, attachment storage, admin calendar controls, PostgreSQL storage, email notifications, and 24-hour reminders.

## Features

- Public booking page without login.
- Default availability: Monday-Friday 8:00 PM-12:00 AM ET; Saturday-Sunday 10:00 AM-1:00 PM and 7:00 PM-12:00 AM ET.
- Manual public booking requires a name; Zoom link is optional after confirmation.
- Public Zoom invite parser with confirmation before any booking is created.
- Optional file uploads are stored with the booking in the database.
- Admin login for full booking details, Zoom links, deletion, and availability rules.
- Public calendar shows available and anonymous blocked slots without exposing booking details.
- New booking notification and 24-hour reminder email support.
- Eastern Time display with UTC storage.
- Railway-ready Postgres migration script.

## Local Development

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:3000`.

Without `DATABASE_URL`, local development uses `.data/scheduler.json` with an in-memory fallback if the local filesystem is locked.

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
   - `APP_URL=https://your-railway-domain.up.railway.app`
   - `CRON_SECRET`
   - `RESEND_API_KEY` and `RESEND_FROM_EMAIL`, or SMTP variables if email should send from Gmail.
6. Set Railway pre-deploy command:

```bash
npm run db:migrate
```

7. Deploy and generate a public domain.

For Gmail SMTP, create a Google App Password and put it in `SMTP_PASS`. Do not use your normal Gmail password.

## 24-Hour Reminder Cron

The reminder endpoint is protected by `CRON_SECRET`:

```text
POST /api/cron/reminders
Authorization: Bearer <CRON_SECRET>
```

Recommended Railway setup:

1. Keep the main web service start command as `npm start`.
2. Add a second Railway service from the same GitHub repo for reminders.
3. Set the reminder service start command to:

```bash
npm run reminders:24h
```

4. Add these variables to the reminder service:
   - `APP_URL=https://your-railway-domain.up.railway.app`
   - `CRON_SECRET` with the same value as the web service.
5. In the reminder service Settings, set Cron Schedule to run hourly:

```cron
0 * * * *
```

Railway cron schedules use UTC. The reminder job is idempotent: once a booking reminder is sent, `reminder24hSentAt` is saved so later cron runs do not resend it.
