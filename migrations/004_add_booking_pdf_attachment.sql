ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS attachment_file_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS attachment_data BYTEA;
