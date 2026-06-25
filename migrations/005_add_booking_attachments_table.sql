CREATE TABLE IF NOT EXISTS booking_attachments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_attachments_booking_id_idx ON booking_attachments (booking_id);

INSERT INTO booking_attachments (id, booking_id, file_name, mime_type, data, created_at)
SELECT
  'legacy-' || id,
  id,
  attachment_file_name,
  COALESCE(attachment_mime_type, 'application/octet-stream'),
  attachment_data,
  created_at
FROM bookings
WHERE attachment_file_name IS NOT NULL
  AND attachment_data IS NOT NULL
ON CONFLICT (id) DO NOTHING;
