import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { AvailabilityRule, Booking, BookingInput } from "@/lib/types";
import { overlaps } from "@/lib/availability";
import { EASTERN_TIME_ZONE } from "@/lib/time";

type AdminUser = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

type JsonData = {
  availabilityRules: AvailabilityRule[];
  bookings: Booking[];
  adminUsers: AdminUser[];
};

let memoryData: JsonData | null = null;
let memoryOnly = false;

function getDataPath(): string {
  return process.env.LOCAL_DATA_PATH || path.join(process.cwd(), ".data", "scheduler.json");
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeBooking(booking: Booking): Booking {
  return {
    ...booking,
    attachmentFileName: booking.attachmentFileName || null,
    attachmentMimeType: booking.attachmentMimeType || null,
    attachmentDataBase64: booking.attachmentDataBase64 || null,
  };
}

function defaultRules(): AvailabilityRule[] {
  const rules = [
    ...[1, 2, 3, 4, 5].map((weekday) => ({
      id: `default-${weekday}-20-24`,
      weekday,
      startTimeLocal: "20:00",
      endTimeLocal: "24:00",
    })),
    { id: "default-6-10-13", weekday: 6, startTimeLocal: "10:00", endTimeLocal: "13:00" },
    { id: "default-6-19-24", weekday: 6, startTimeLocal: "19:00", endTimeLocal: "24:00" },
    { id: "default-0-10-13", weekday: 0, startTimeLocal: "10:00", endTimeLocal: "13:00" },
    { id: "default-0-19-24", weekday: 0, startTimeLocal: "19:00", endTimeLocal: "24:00" },
  ];

  return rules.map((rule) => ({
    ...rule,
    slotMinutes: 60,
    timezone: EASTERN_TIME_ZONE,
    isActive: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));
}

async function readData(): Promise<JsonData> {
  if (memoryData) {
    return memoryData;
  }

  try {
    const raw = await fs.readFile(getDataPath(), "utf8");
    return JSON.parse(raw) as JsonData;
  } catch {
    const data: JsonData = {
      availabilityRules: defaultRules(),
      bookings: [],
      adminUsers: [],
    };
    await writeData(data);
    return data;
  }
}

async function writeData(data: JsonData): Promise<void> {
  if (memoryOnly) {
    memoryData = data;
    return;
  }

  const dataPath = getDataPath();
  try {
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    const tempPath = `${dataPath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tempPath, dataPath);
  } catch (error) {
    memoryOnly = true;
    memoryData = data;
    console.warn("Local JSON storage is using in-memory fallback.", error);
  }
}

export class JsonStore {
  async ensureDefaultAvailability(): Promise<void> {
    const data = await readData();
    const hasOldDefaults = data.availabilityRules.some((rule) => /^default-[1-5]-9-17$/.test(rule.id));
    if (data.availabilityRules.length === 0 || hasOldDefaults) {
      data.availabilityRules = data.availabilityRules.filter((rule) => !/^default-[1-5]-9-17$/.test(rule.id));
      const existingIds = new Set(data.availabilityRules.map((rule) => rule.id));
      data.availabilityRules.push(...defaultRules().filter((rule) => !existingIds.has(rule.id)));
      await writeData(data);
      return;
    }

    const defaultIds = new Set(defaultRules().map((rule) => rule.id));
    const existingDefaultIds = new Set(data.availabilityRules.filter((rule) => defaultIds.has(rule.id)).map((rule) => rule.id));
    if (existingDefaultIds.size < defaultIds.size) {
      data.availabilityRules.push(...defaultRules().filter((rule) => !existingDefaultIds.has(rule.id)));
      await writeData(data);
    }
  }

  async listAvailabilityRules(): Promise<AvailabilityRule[]> {
    const data = await readData();
    return data.availabilityRules;
  }

  async createAvailabilityRule(input: Omit<AvailabilityRule, "id" | "createdAt" | "updatedAt">): Promise<AvailabilityRule> {
    const data = await readData();
    const rule: AvailabilityRule = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    data.availabilityRules.push(rule);
    await writeData(data);
    return rule;
  }

  async updateAvailabilityRule(id: string, input: Partial<AvailabilityRule>): Promise<AvailabilityRule | null> {
    const data = await readData();
    const index = data.availabilityRules.findIndex((rule) => rule.id === id);
    if (index < 0) {
      return null;
    }
    data.availabilityRules[index] = { ...data.availabilityRules[index], ...input, id, updatedAt: nowIso() };
    await writeData(data);
    return data.availabilityRules[index];
  }

  async deleteAvailabilityRule(id: string): Promise<boolean> {
    const data = await readData();
    const before = data.availabilityRules.length;
    data.availabilityRules = data.availabilityRules.filter((rule) => rule.id !== id);
    await writeData(data);
    return data.availabilityRules.length !== before;
  }

  async listBookings(fromUtc?: string, toUtc?: string): Promise<Booking[]> {
    const data = await readData();
    return data.bookings
      .map(normalizeBooking)
      .filter((booking) => {
        if (!fromUtc || !toUtc) {
          return true;
        }
        return overlaps(booking.startAtUtc, booking.endAtUtc, fromUtc, toUtc);
      })
      .sort((a, b) => a.startAtUtc.localeCompare(b.startAtUtc));
  }

  async createBooking(input: BookingInput): Promise<Booking> {
    const data = await readData();
    const conflict = data.bookings.find(
      (booking) =>
        booking.status !== "cancelled" && overlaps(input.startAtUtc, input.endAtUtc, booking.startAtUtc, booking.endAtUtc)
    );
    if (conflict) {
      throw new Error("BOOKING_CONFLICT");
    }
    const timestamp = nowIso();
    const booking: Booking = {
      id: crypto.randomUUID(),
      source: input.source,
      title: input.title,
      startAtUtc: input.startAtUtc,
      endAtUtc: input.endAtUtc,
      bookerName: input.bookerName || null,
      bookerEmail: input.bookerEmail || null,
      notes: input.notes || null,
      invitedByName: input.invitedByName || null,
      zoomJoinUrl: input.zoomJoinUrl || null,
      meetingId: input.meetingId || null,
      passcode: input.passcode || null,
      rawInviteText: input.rawInviteText || null,
      attachmentFileName: input.attachmentFileName || null,
      attachmentMimeType: input.attachmentMimeType || null,
      attachmentDataBase64: input.attachmentDataBase64 || null,
      status: "confirmed",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    data.bookings.push(booking);
    await writeData(data);
    return booking;
  }

  async updateBooking(id: string, input: Partial<BookingInput & { status: Booking["status"] }>): Promise<Booking | null> {
    const data = await readData();
    const index = data.bookings.findIndex((booking) => booking.id === id);
    if (index < 0) {
      return null;
    }
    data.bookings[index] = normalizeBooking({ ...data.bookings[index], ...input, id, updatedAt: nowIso() });
    await writeData(data);
    return data.bookings[index];
  }

  async deleteBooking(id: string): Promise<boolean> {
    const data = await readData();
    const before = data.bookings.length;
    data.bookings = data.bookings.filter((booking) => booking.id !== id);
    await writeData(data);
    return data.bookings.length !== before;
  }

  async countAdminUsers(): Promise<number> {
    const data = await readData();
    return data.adminUsers.length;
  }

  async getAdminByEmail(email: string): Promise<AdminUser | null> {
    const data = await readData();
    return data.adminUsers.find((user) => user.email === email.toLowerCase()) || null;
  }

  async createAdminUser(email: string, passwordHash: string): Promise<void> {
    const data = await readData();
    const existing = data.adminUsers.find((user) => user.email === email.toLowerCase());
    if (existing) {
      existing.passwordHash = passwordHash;
    } else {
      data.adminUsers.push({ id: crypto.randomUUID(), email: email.toLowerCase(), passwordHash, createdAt: nowIso() });
    }
    await writeData(data);
  }
}
