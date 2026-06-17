DELETE FROM availability_rules
WHERE id IN (
  'default-mon-9-17',
  'default-tue-9-17',
  'default-wed-9-17',
  'default-thu-9-17',
  'default-fri-9-17'
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
ON CONFLICT (id) DO UPDATE
SET start_time_local = EXCLUDED.start_time_local,
    end_time_local = EXCLUDED.end_time_local,
    slot_minutes = EXCLUDED.slot_minutes,
    timezone = EXCLUDED.timezone,
    is_active = EXCLUDED.is_active,
    updated_at = now();
