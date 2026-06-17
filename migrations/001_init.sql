CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS availability_rules (
  id TEXT PRIMARY KEY,
  weekday INTEGER NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  start_time_local TEXT NOT NULL,
  end_time_local TEXT NOT NULL,
  slot_minutes INTEGER NOT NULL DEFAULT 60 CHECK (slot_minutes > 0),
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  start_at_utc TIMESTAMPTZ NOT NULL,
  end_at_utc TIMESTAMPTZ NOT NULL,
  booker_name TEXT,
  booker_email TEXT,
  notes TEXT,
  invited_by_name TEXT,
  zoom_join_url TEXT,
  meeting_id TEXT,
  passcode TEXT,
  raw_invite_text TEXT,
  attachment_file_name TEXT,
  attachment_mime_type TEXT,
  attachment_data BYTEA,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_time_idx ON bookings (start_at_utc, end_at_utc);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO availability_rules (id, weekday, start_time_local, end_time_local, slot_minutes, timezone, is_active)
VALUES
  ('default-mon-20-24', 1, '20:00', '24:00', 60, 'America/New_York', true),
  ('default-tue-20-24', 2, '20:00', '24:00', 60, 'America/New_York', true),
  ('default-wed-20-24', 3, '20:00', '24:00', 60, 'America/New_York', true),
  ('default-thu-20-24', 4, '20:00', '24:00', 60, 'America/New_York', true),
  ('default-fri-20-24', 5, '20:00', '24:00', 60, 'America/New_York', true),
  ('default-sat-10-13', 6, '10:00', '13:00', 60, 'America/New_York', true),
  ('default-sat-19-24', 6, '19:00', '24:00', 60, 'America/New_York', true),
  ('default-sun-10-13', 0, '10:00', '13:00', 60, 'America/New_York', true),
  ('default-sun-19-24', 0, '19:00', '24:00', 60, 'America/New_York', true)
ON CONFLICT (id) DO NOTHING;
