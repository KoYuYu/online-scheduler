ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS bookings_24h_reminder_idx
  ON bookings (start_at_utc)
  WHERE status = 'confirmed' AND reminder_24h_sent_at IS NULL;
