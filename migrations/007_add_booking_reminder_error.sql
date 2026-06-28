ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reminder_24h_last_error TEXT;
