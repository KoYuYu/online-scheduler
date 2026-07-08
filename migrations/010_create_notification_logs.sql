CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_logs_booking_created_idx
  ON notification_logs (booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_logs_status_idx
  ON notification_logs (status, created_at DESC);
