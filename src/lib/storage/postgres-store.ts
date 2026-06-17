import crypto from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { AvailabilityRule, Booking, BookingInput } from "@/lib/types";

type AdminUser = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

function byteaToBase64(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("base64");
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }
  return null;
}

function mapBooking(row: Record<string, unknown>): Booking {
  return {
    id: String(row.id),
    source: row.source as Booking["source"],
    title: String(row.title),
    startAtUtc: new Date(row.start_at_utc as string).toISOString(),
    endAtUtc: new Date(row.end_at_utc as string).toISOString(),
    bookerName: (row.booker_name as string | null) || null,
    bookerEmail: (row.booker_email as string | null) || null,
    notes: (row.notes as string | null) || null,
    invitedByName: (row.invited_by_name as string | null) || null,
    zoomJoinUrl: (row.zoom_join_url as string | null) || null,
    meetingId: (row.meeting_id as string | null) || null,
    passcode: (row.passcode as string | null) || null,
    rawInviteText: (row.raw_invite_text as string | null) || null,
    attachmentFileName: (row.attachment_file_name as string | null) || null,
    attachmentMimeType: (row.attachment_mime_type as string | null) || null,
    attachmentDataBase64: byteaToBase64(row.attachment_data),
    status: row.status as Booking["status"],
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function mapRule(row: Record<string, unknown>): AvailabilityRule {
  return {
    id: String(row.id),
    weekday: Number(row.weekday),
    startTimeLocal: String(row.start_time_local),
    endTimeLocal: String(row.end_time_local),
    slotMinutes: Number(row.slot_minutes),
    timezone: String(row.timezone),
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export class PostgresStore {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async ensureDefaultAvailability(): Promise<void> {
    const result = await this.pool.query("SELECT COUNT(*)::int AS count FROM availability_rules");
    if (Number(result.rows[0]?.count || 0) > 0) {
      return;
    }
    const defaultRules = [
      ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTimeLocal: "20:00", endTimeLocal: "24:00" })),
      { weekday: 6, startTimeLocal: "10:00", endTimeLocal: "13:00" },
      { weekday: 6, startTimeLocal: "19:00", endTimeLocal: "24:00" },
      { weekday: 0, startTimeLocal: "10:00", endTimeLocal: "13:00" },
      { weekday: 0, startTimeLocal: "19:00", endTimeLocal: "24:00" },
    ];

    for (const rule of defaultRules) {
      await this.createAvailabilityRule({
        weekday: rule.weekday,
        startTimeLocal: rule.startTimeLocal,
        endTimeLocal: rule.endTimeLocal,
        slotMinutes: 60,
        timezone: "America/New_York",
        isActive: true,
      });
    }
  }

  async listAvailabilityRules(): Promise<AvailabilityRule[]> {
    const result = await this.pool.query("SELECT * FROM availability_rules ORDER BY weekday, start_time_local");
    return result.rows.map(mapRule);
  }

  async createAvailabilityRule(input: Omit<AvailabilityRule, "id" | "createdAt" | "updatedAt">): Promise<AvailabilityRule> {
    const result = await this.pool.query(
      `INSERT INTO availability_rules (id, weekday, start_time_local, end_time_local, slot_minutes, timezone, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [crypto.randomUUID(), input.weekday, input.startTimeLocal, input.endTimeLocal, input.slotMinutes, input.timezone, input.isActive]
    );
    return mapRule(result.rows[0]);
  }

  async updateAvailabilityRule(id: string, input: Partial<AvailabilityRule>): Promise<AvailabilityRule | null> {
    const current = await this.pool.query("SELECT * FROM availability_rules WHERE id = $1", [id]);
    if (!current.rowCount) {
      return null;
    }
    const merged = { ...mapRule(current.rows[0]), ...input };
    const result = await this.pool.query(
      `UPDATE availability_rules
       SET weekday = $2, start_time_local = $3, end_time_local = $4, slot_minutes = $5, timezone = $6, is_active = $7, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, merged.weekday, merged.startTimeLocal, merged.endTimeLocal, merged.slotMinutes, merged.timezone, merged.isActive]
    );
    return mapRule(result.rows[0]);
  }

  async deleteAvailabilityRule(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM availability_rules WHERE id = $1", [id]);
    return Boolean(result.rowCount);
  }

  async listBookings(fromUtc?: string, toUtc?: string): Promise<Booking[]> {
    const result =
      fromUtc && toUtc
        ? await this.pool.query(
            `SELECT * FROM bookings
             WHERE start_at_utc < $2::timestamptz AND end_at_utc > $1::timestamptz
             ORDER BY start_at_utc`,
            [fromUtc, toUtc]
          )
        : await this.pool.query("SELECT * FROM bookings ORDER BY start_at_utc");
    return result.rows.map(mapBooking);
  }

  async createBooking(input: BookingInput): Promise<Booking> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const conflict = await client.query(
        `SELECT id FROM bookings
         WHERE status <> 'cancelled'
           AND start_at_utc < $2::timestamptz
           AND end_at_utc > $1::timestamptz
         LIMIT 1`,
        [input.startAtUtc, input.endAtUtc]
      );
      if (conflict.rowCount) {
        throw new Error("BOOKING_CONFLICT");
      }
      const booking = await this.insertBooking(client, input);
      await client.query("COMMIT");
      return booking;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertBooking(client: PoolClient, input: BookingInput): Promise<Booking> {
    const result = await client.query(
      `INSERT INTO bookings (
        id, source, title, start_at_utc, end_at_utc, booker_name, booker_email, notes,
        invited_by_name, zoom_join_url, meeting_id, passcode, raw_invite_text,
        attachment_file_name, attachment_mime_type, attachment_data
       )
       VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        crypto.randomUUID(),
        input.source,
        input.title,
        input.startAtUtc,
        input.endAtUtc,
        input.bookerName || null,
        input.bookerEmail || null,
        input.notes || null,
        input.invitedByName || null,
        input.zoomJoinUrl || null,
        input.meetingId || null,
        input.passcode || null,
        input.rawInviteText || null,
        input.attachmentFileName || null,
        input.attachmentMimeType || null,
        input.attachmentDataBase64 ? Buffer.from(input.attachmentDataBase64, "base64") : null,
      ]
    );
    return mapBooking(result.rows[0]);
  }

  async updateBooking(id: string, input: Partial<BookingInput & { status: Booking["status"] }>): Promise<Booking | null> {
    const current = await this.pool.query("SELECT * FROM bookings WHERE id = $1", [id]);
    if (!current.rowCount) {
      return null;
    }
    const merged = { ...mapBooking(current.rows[0]), ...input };
    const result = await this.pool.query(
      `UPDATE bookings
       SET source = $2, title = $3, start_at_utc = $4::timestamptz, end_at_utc = $5::timestamptz,
           booker_name = $6, booker_email = $7, notes = $8, invited_by_name = $9, zoom_join_url = $10,
           meeting_id = $11, passcode = $12, raw_invite_text = $13, attachment_file_name = $14,
           attachment_mime_type = $15, attachment_data = $16, status = $17, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        merged.source,
        merged.title,
        merged.startAtUtc,
        merged.endAtUtc,
        merged.bookerName,
        merged.bookerEmail,
        merged.notes,
        merged.invitedByName,
        merged.zoomJoinUrl,
        merged.meetingId,
        merged.passcode,
        merged.rawInviteText,
        merged.attachmentFileName,
        merged.attachmentMimeType,
        merged.attachmentDataBase64 ? Buffer.from(merged.attachmentDataBase64, "base64") : null,
        merged.status,
      ]
    );
    return mapBooking(result.rows[0]);
  }

  async deleteBooking(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM bookings WHERE id = $1", [id]);
    return Boolean(result.rowCount);
  }

  async countAdminUsers(): Promise<number> {
    const result = await this.pool.query("SELECT COUNT(*)::int AS count FROM admin_users");
    return Number(result.rows[0]?.count || 0);
  }

  async getAdminByEmail(email: string): Promise<AdminUser | null> {
    const result = await this.pool.query("SELECT * FROM admin_users WHERE email = $1", [email.toLowerCase()]);
    if (!result.rowCount) {
      return null;
    }
    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  async createAdminUser(email: string, passwordHash: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO admin_users (id, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [crypto.randomUUID(), email.toLowerCase(), passwordHash]
    );
  }
}
