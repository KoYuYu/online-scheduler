INSERT INTO availability_rules (id, weekday, start_time_local, end_time_local, slot_minutes, timezone, is_active)
VALUES
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
