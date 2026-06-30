ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_1h_last_error TEXT;

CREATE INDEX IF NOT EXISTS bookings_1h_reminder_idx
  ON bookings (start_at_utc)
  WHERE status = 'confirmed' AND reminder_1h_sent_at IS NULL;
