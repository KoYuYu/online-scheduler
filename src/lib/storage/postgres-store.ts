import crypto from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { AvailabilityRule, Booking, BookingAttachment, BookingAttachmentInput, BookingInput } from "@/lib/types";

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

function mapAttachment(row: Record<string, unknown>): BookingAttachment {
  return {
    id: String(row.id),
    fileName: String(row.file_name),
    mimeType: String(row.mime_type || "application/octet-stream"),
    dataBase64: byteaToBase64(row.data) || "",
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

function mapBooking(row: Record<string, unknown>, attachments: BookingAttachment[] = []): Booking {
  const legacyAttachment =
    row.attachment_file_name && row.attachment_data
      ? {
          id: `legacy-${String(row.id)}`,
          fileName: String(row.attachment_file_name),
          mimeType: String(row.attachment_mime_type || "application/octet-stream"),
          dataBase64: byteaToBase64(row.attachment_data) || "",
          createdAt: new Date(row.created_at as string).toISOString(),
        }
      : null;
  const finalAttachments = attachments.length ? attachments : legacyAttachment ? [legacyAttachment] : [];
  const firstAttachment = finalAttachments[0] || null;
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
    attachmentFileName: firstAttachment?.fileName || null,
    attachmentMimeType: firstAttachment?.mimeType || null,
    attachmentDataBase64: firstAttachment?.dataBase64 || null,
    attachments: finalAttachments,
    reminder24hSentAt: row.reminder_24h_sent_at ? new Date(row.reminder_24h_sent_at as string).toISOString() : null,
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

function normalizeAttachmentInput(input: BookingAttachmentInput): Omit<BookingAttachment, "id" | "createdAt"> | null {
  if (!input.fileName || !input.dataBase64) {
    return null;
  }
  return {
    fileName: input.fileName,
    mimeType: input.mimeType || "application/octet-stream",
    dataBase64: input.dataBase64,
  };
}

function inputAttachments(input: Partial<BookingInput>): Array<Omit<BookingAttachment, "id" | "createdAt">> {
  const attachments = (input.attachments || [])
    .map((attachment) => normalizeAttachmentInput(attachment))
    .filter((attachment): attachment is Omit<BookingAttachment, "id" | "createdAt"> => Boolean(attachment));

  if (attachments.length) {
    return attachments;
  }

  const legacyAttachment = normalizeAttachmentInput({
    fileName: input.attachmentFileName || null,
    mimeType: input.attachmentMimeType || null,
    dataBase64: input.attachmentDataBase64 || null,
  });
  return legacyAttachment ? [legacyAttachment] : [];
}

export class PostgresStore {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 10000,
    });
    this.pool.on("error", (error) => {
      console.error("Unexpected idle Postgres client error.", error);
    });
  }

  async healthCheck(): Promise<void> {
    await this.pool.query("SELECT 1");
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
    return this.mapBookingsWithAttachments(result.rows);
  }

  private async mapBookingsWithAttachments(rows: Record<string, unknown>[]): Promise<Booking[]> {
    if (!rows.length) {
      return [];
    }
    const ids = rows.map((row) => String(row.id));
    const attachmentsByBookingId = await this.listAttachmentsByBookingIds(ids);
    return rows.map((row) => mapBooking(row, attachmentsByBookingId.get(String(row.id)) || []));
  }

  private async listAttachmentsByBookingIds(ids: string[], client: Pool | PoolClient = this.pool): Promise<Map<string, BookingAttachment[]>> {
    const attachmentsByBookingId = new Map<string, BookingAttachment[]>();
    if (!ids.length) {
      return attachmentsByBookingId;
    }
    const result = await client.query(
      `SELECT * FROM booking_attachments
       WHERE booking_id = ANY($1::text[])
       ORDER BY created_at, id`,
      [ids]
    );
    for (const row of result.rows) {
      const bookingId = String(row.booking_id);
      const current = attachmentsByBookingId.get(bookingId) || [];
      current.push(mapAttachment(row));
      attachmentsByBookingId.set(bookingId, current);
    }
    return attachmentsByBookingId;
  }

  private async replaceBookingAttachments(
    client: PoolClient,
    bookingId: string,
    attachments: Array<Omit<BookingAttachment, "id" | "createdAt">>
  ): Promise<void> {
    await client.query("DELETE FROM booking_attachments WHERE booking_id = $1", [bookingId]);
    await this.appendBookingAttachments(client, bookingId, attachments);
  }

  private async appendBookingAttachments(
    client: PoolClient,
    bookingId: string,
    attachments: Array<Omit<BookingAttachment, "id" | "createdAt">>
  ): Promise<void> {
    for (const attachment of attachments) {
      await client.query(
        `INSERT INTO booking_attachments (id, booking_id, file_name, mime_type, data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          crypto.randomUUID(),
          bookingId,
          attachment.fileName,
          attachment.mimeType,
          Buffer.from(attachment.dataBase64, "base64"),
        ]
      );
    }
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
    const bookingId = crypto.randomUUID();
    const attachments = inputAttachments(input);
    const firstAttachment = attachments[0] || null;
    const result = await client.query(
      `INSERT INTO bookings (
        id, source, title, start_at_utc, end_at_utc, booker_name, booker_email, notes,
        invited_by_name, zoom_join_url, meeting_id, passcode, raw_invite_text,
        attachment_file_name, attachment_mime_type, attachment_data
       )
       VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        bookingId,
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
        firstAttachment?.fileName || null,
        firstAttachment?.mimeType || null,
        firstAttachment ? Buffer.from(firstAttachment.dataBase64, "base64") : null,
      ]
    );
    await this.appendBookingAttachments(client, bookingId, attachments);
    const attachmentsByBookingId = await this.listAttachmentsByBookingIds([bookingId], client);
    return mapBooking(result.rows[0], attachmentsByBookingId.get(bookingId) || []);
  }

  async updateBooking(id: string, input: Partial<BookingInput & { status: Booking["status"] }>): Promise<Booking | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const current = await client.query("SELECT * FROM bookings WHERE id = $1 FOR UPDATE", [id]);
      if (!current.rowCount) {
        await client.query("ROLLBACK");
        return null;
      }
      const currentAttachmentsByBookingId = await this.listAttachmentsByBookingIds([id], client);
      const currentBooking = mapBooking(current.rows[0], currentAttachmentsByBookingId.get(id) || []);
      const legacyAttachmentPatch =
        "attachmentFileName" in input || "attachmentMimeType" in input || "attachmentDataBase64" in input;
      const replacementAttachments = input.attachments !== undefined || legacyAttachmentPatch ? inputAttachments(input) : currentBooking.attachments;
      const appendAttachments = (input.appendAttachments || [])
        .map((attachment) => normalizeAttachmentInput(attachment))
        .filter((attachment): attachment is Omit<BookingAttachment, "id" | "createdAt"> => Boolean(attachment));
      const removedIds = new Set(input.removeAttachmentIds || []);
      const nextAttachments = (input.clearAttachments ? [] : replacementAttachments)
        .filter((attachment) => !("id" in attachment) || typeof attachment.id !== "string" || !removedIds.has(attachment.id))
        .map((attachment) => ({
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          dataBase64: attachment.dataBase64,
        }))
        .concat(appendAttachments);
      const firstAttachment = nextAttachments[0] || null;
      const merged = {
        ...currentBooking,
        ...input,
        attachmentFileName: firstAttachment?.fileName || null,
        attachmentMimeType: firstAttachment?.mimeType || null,
        attachmentDataBase64: firstAttachment?.dataBase64 || null,
      };
      const conflict =
        merged.status === "cancelled"
          ? { rowCount: 0 }
          : await client.query(
              `SELECT id FROM bookings
               WHERE id <> $3
                 AND status <> 'cancelled'
                 AND start_at_utc < $2::timestamptz
                 AND end_at_utc > $1::timestamptz
               LIMIT 1`,
              [merged.startAtUtc, merged.endAtUtc, id]
            );
      if (conflict.rowCount) {
        throw new Error("BOOKING_CONFLICT");
      }
      const result = await client.query(
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
          firstAttachment?.fileName || null,
          firstAttachment?.mimeType || null,
          firstAttachment ? Buffer.from(firstAttachment.dataBase64, "base64") : null,
          merged.status,
        ]
      );
      await this.replaceBookingAttachments(client, id, nextAttachments);
      const attachmentsByBookingId = await this.listAttachmentsByBookingIds([id], client);
      await client.query("COMMIT");
      return mapBooking(result.rows[0], attachmentsByBookingId.get(id) || []);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async markBookingReminder24hSent(id: string, sentAt: string): Promise<Booking | null> {
    const result = await this.pool.query(
      `UPDATE bookings
       SET reminder_24h_sent_at = COALESCE(reminder_24h_sent_at, $2::timestamptz),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, sentAt]
    );
    const [booking] = await this.mapBookingsWithAttachments(result.rows);
    return booking || null;
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
