import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type {
  AvailabilityRule,
  Booking,
  BookingAttachment,
  BookingAttachmentInput,
  BookingCreateOptions,
  BookingInput,
  BookingPage,
  BookingPageOptions,
  NotificationJob,
  NotificationLog,
  NotificationLogInput,
  PushSubscriptionInput,
  PushSubscriptionRecord,
} from "@/lib/types";
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
  pushSubscriptions: PushSubscriptionRecord[];
  notificationLogs: NotificationLog[];
  notificationJobs: NotificationJob[];
};

let memoryData: JsonData | null = null;
let memoryOnly = false;

function getDataPath(): string {
  return process.env.LOCAL_DATA_PATH || path.join(process.cwd(), ".data", "scheduler.json");
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeAttachment(input: BookingAttachmentInput & { id?: string; createdAt?: string }): BookingAttachment | null {
  if (!input.fileName || !input.dataBase64) {
    return null;
  }
  return {
    id: input.id || crypto.randomUUID(),
    fileName: input.fileName,
    mimeType: input.mimeType || "application/octet-stream",
    dataBase64: input.dataBase64,
    createdAt: input.createdAt || nowIso(),
  };
}

function inputAttachments(input: Partial<BookingInput>): BookingAttachment[] {
  const attachments = (input.attachments || [])
    .map((attachment) => normalizeAttachment(attachment))
    .filter((attachment): attachment is BookingAttachment => Boolean(attachment));

  if (attachments.length) {
    return attachments;
  }

  const legacyAttachment = normalizeAttachment({
    fileName: input.attachmentFileName || null,
    mimeType: input.attachmentMimeType || null,
    dataBase64: input.attachmentDataBase64 || null,
  });
  return legacyAttachment ? [legacyAttachment] : [];
}

function normalizeBooking(booking: Booking): Booking {
  const attachments =
    booking.attachments?.length
      ? booking.attachments
          .map((attachment) => normalizeAttachment(attachment))
          .filter((attachment): attachment is BookingAttachment => Boolean(attachment))
      : inputAttachments(booking);
  const firstAttachment = attachments[0] || null;
  return {
    ...booking,
    attachmentFileName: firstAttachment?.fileName || null,
    attachmentMimeType: firstAttachment?.mimeType || null,
    attachmentDataBase64: firstAttachment?.dataBase64 || null,
    attachments,
    reminder24hSentAt: booking.reminder24hSentAt || null,
    reminder24hLastError: booking.reminder24hLastError || null,
    reminder1hSentAt: booking.reminder1hSentAt || null,
    reminder1hLastError: booking.reminder1hLastError || null,
    notificationLogs: booking.notificationLogs || [],
  };
}

function normalizeNotificationLog(log: Partial<NotificationLog>): NotificationLog | null {
  if (!log.bookingId || !log.kind || !log.channel || !log.status) {
    return null;
  }
  return {
    id: log.id || crypto.randomUUID(),
    bookingId: log.bookingId,
    kind: log.kind,
    channel: log.channel,
    status: log.status,
    detail: log.detail || null,
    createdAt: log.createdAt || nowIso(),
  };
}

function normalizeNotificationJob(job: Partial<NotificationJob>): NotificationJob | null {
  if (!job.id || !job.dedupeKey || !job.kind || !Array.isArray(job.bookingIds) || !job.status) {
    return null;
  }
  const timestamp = nowIso();
  return {
    id: job.id,
    dedupeKey: job.dedupeKey,
    kind: job.kind,
    bookingIds: job.bookingIds.map(String),
    status: job.status,
    attempts: Number(job.attempts || 0),
    availableAt: job.availableAt || timestamp,
    lockedAt: job.lockedAt || null,
    lastError: job.lastError || null,
    createdAt: job.createdAt || timestamp,
    updatedAt: job.updatedAt || timestamp,
  };
}

function attachNotificationLogs(booking: Booking, logs: NotificationLog[]): Booking {
  return {
    ...booking,
    notificationLogs: logs
      .filter((log) => log.bookingId === booking.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 12),
  };
}

function withoutAttachmentData(booking: Booking): Booking {
  return {
    ...booking,
    attachmentDataBase64: null,
    attachments: booking.attachments.map(({ dataBase64: _dataBase64, ...attachment }) => attachment),
  };
}

function normalizePushSubscription(subscription: Partial<PushSubscriptionRecord>): PushSubscriptionRecord | null {
  if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
    return null;
  }
  const timestamp = nowIso();
  return {
    id: subscription.id || crypto.randomUUID(),
    endpoint: subscription.endpoint,
    p256dh: subscription.p256dh,
    auth: subscription.auth,
    userAgent: subscription.userAgent || null,
    lastError: subscription.lastError || null,
    createdAt: subscription.createdAt || timestamp,
    updatedAt: subscription.updatedAt || timestamp,
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
    const parsed = JSON.parse(raw) as Partial<JsonData>;
    return {
      availabilityRules: parsed.availabilityRules || defaultRules(),
      bookings: parsed.bookings || [],
      adminUsers: parsed.adminUsers || [],
      pushSubscriptions: (parsed.pushSubscriptions || [])
        .map((subscription) => normalizePushSubscription(subscription))
        .filter((subscription): subscription is PushSubscriptionRecord => Boolean(subscription)),
      notificationLogs: (parsed.notificationLogs || [])
        .map((log) => normalizeNotificationLog(log))
        .filter((log): log is NotificationLog => Boolean(log)),
      notificationJobs: (parsed.notificationJobs || [])
        .map((job) => normalizeNotificationJob(job))
        .filter((job): job is NotificationJob => Boolean(job)),
    };
  } catch {
    const data: JsonData = {
      availabilityRules: defaultRules(),
      bookings: [],
      adminUsers: [],
      pushSubscriptions: [],
      notificationLogs: [],
      notificationJobs: [],
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
  async healthCheck(): Promise<void> {
    await readData();
  }

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
      .map((booking) => attachNotificationLogs(booking, data.notificationLogs))
      .sort((a, b) => a.startAtUtc.localeCompare(b.startAtUtc));
  }

  async getBookingsByIds(ids: string[], includeAttachmentData = true): Promise<Booking[]> {
    const data = await readData();
    const byId = new Map(
      data.bookings
        .map(normalizeBooking)
        .map((booking) => [booking.id, attachNotificationLogs(booking, data.notificationLogs)] as const)
    );
    return ids
      .map((id) => byId.get(id))
      .filter((booking): booking is Booking => Boolean(booking))
      .map((booking) => includeAttachmentData ? booking : withoutAttachmentData(booking));
  }

  async listBookingPage(options: BookingPageOptions): Promise<BookingPage> {
    const data = await readData();
    const nowTime = new Date(options.now).getTime();
    const limit = Math.max(1, Math.min(100, Math.floor(options.limit || 30)));
    const direction = options.scope === "past" ? -1 : 1;
    const scoped = data.bookings
      .map(normalizeBooking)
      .filter((booking) =>
        options.scope === "past"
          ? new Date(booking.endAtUtc).getTime() < nowTime
          : new Date(booking.endAtUtc).getTime() >= nowTime
      )
      .sort((left, right) => direction * (left.startAtUtc.localeCompare(right.startAtUtc) || left.id.localeCompare(right.id)));
    const afterCursor = options.cursor
      ? scoped.filter((booking) => {
          const comparison = booking.startAtUtc.localeCompare(options.cursor!.startAtUtc) || booking.id.localeCompare(options.cursor!.id);
          return direction * comparison > 0;
        })
      : scoped;
    const pageItems = afterCursor.slice(0, limit);
    const last = pageItems[pageItems.length - 1];
    return {
      bookings: pageItems.map((booking) => withoutAttachmentData(attachNotificationLogs(booking, data.notificationLogs))),
      nextCursor: afterCursor.length > limit && last ? { startAtUtc: last.startAtUtc, id: last.id } : null,
      total: scoped.length,
    };
  }

  async getBookingAttachment(bookingId: string, attachmentId: string): Promise<BookingAttachment | null> {
    const data = await readData();
    const booking = data.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      return null;
    }
    return normalizeBooking(booking).attachments.find((attachment) => attachment.id === attachmentId) || null;
  }

  async listNotificationLogs(bookingId?: string): Promise<NotificationLog[]> {
    const data = await readData();
    return data.notificationLogs
      .map((log) => normalizeNotificationLog(log))
      .filter((log): log is NotificationLog => Boolean(log))
      .filter((log) => !bookingId || log.bookingId === bookingId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async createNotificationLog(input: NotificationLogInput): Promise<NotificationLog> {
    const data = await readData();
    const log = normalizeNotificationLog({
      id: crypto.randomUUID(),
      bookingId: input.bookingId,
      kind: input.kind,
      channel: input.channel,
      status: input.status,
      detail: input.detail?.slice(0, 1000) || null,
      createdAt: nowIso(),
    });
    if (!log) {
      throw new Error("INVALID_NOTIFICATION_LOG");
    }
    data.notificationLogs.push(log);
    await writeData(data);
    return log;
  }

  async claimNotificationJobs(limit = 10, now = new Date()): Promise<NotificationJob[]> {
    const data = await readData();
    const nowTime = now.getTime();
    const staleBefore = nowTime - 10 * 60 * 1000;
    const jobs = data.notificationJobs
      .filter((job) => {
        const due = new Date(job.availableAt).getTime() <= nowTime;
        const stale = job.status === "processing" && (!job.lockedAt || new Date(job.lockedAt).getTime() < staleBefore);
        return due && (job.status === "pending" || stale);
      })
      .sort((left, right) => left.availableAt.localeCompare(right.availableAt) || left.createdAt.localeCompare(right.createdAt))
      .slice(0, Math.max(1, Math.min(50, Math.floor(limit))));
    const claimedIds = new Set(jobs.map((job) => job.id));
    data.notificationJobs = data.notificationJobs.map((job) =>
      claimedIds.has(job.id)
        ? { ...job, status: "processing", attempts: job.attempts + 1, lockedAt: now.toISOString(), updatedAt: nowIso() }
        : job
    );
    await writeData(data);
    return data.notificationJobs.filter((job) => claimedIds.has(job.id));
  }

  async markNotificationJobSent(id: string): Promise<void> {
    const data = await readData();
    data.notificationJobs = data.notificationJobs.map((job) =>
      job.id === id ? { ...job, status: "sent", lockedAt: null, lastError: null, updatedAt: nowIso() } : job
    );
    await writeData(data);
  }

  async markNotificationJobFailed(id: string, error: string, nextAttemptAt: string, terminal: boolean): Promise<void> {
    const data = await readData();
    data.notificationJobs = data.notificationJobs.map((job) =>
      job.id === id
        ? {
            ...job,
            status: terminal ? "failed" : "pending",
            availableAt: nextAttemptAt,
            lockedAt: null,
            lastError: error.slice(0, 1000),
            updatedAt: nowIso(),
          }
        : job
    );
    await writeData(data);
  }

  async createBooking(input: BookingInput, options: BookingCreateOptions = {}): Promise<Booking> {
    const [booking] = await this.createBookings([input], options);
    return booking;
  }

  async createBookings(inputs: BookingInput[], options: BookingCreateOptions = {}): Promise<Booking[]> {
    if (!inputs.length) {
      return [];
    }
    const data = await readData();
    for (let leftIndex = 0; leftIndex < inputs.length; leftIndex += 1) {
      const input = inputs[leftIndex];
      const conflict = data.bookings.find(
        (booking) =>
          booking.status !== "cancelled" && overlaps(input.startAtUtc, input.endAtUtc, booking.startAtUtc, booking.endAtUtc)
      );
      if (conflict) {
        throw new Error("BOOKING_CONFLICT");
      }
      for (let rightIndex = leftIndex + 1; rightIndex < inputs.length; rightIndex += 1) {
        if (overlaps(input.startAtUtc, input.endAtUtc, inputs[rightIndex].startAtUtc, inputs[rightIndex].endAtUtc)) {
          throw new Error("BOOKING_INPUT_OVERLAP");
        }
      }
    }
    const timestamp = nowIso();
    const bookings = inputs.map((input): Booking => {
      const attachments = inputAttachments(input);
      const firstAttachment = attachments[0] || null;
      return {
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
        attachmentFileName: firstAttachment?.fileName || null,
        attachmentMimeType: firstAttachment?.mimeType || null,
        attachmentDataBase64: firstAttachment?.dataBase64 || null,
        attachments,
        reminder24hSentAt: null,
        reminder24hLastError: null,
        reminder1hSentAt: null,
        reminder1hLastError: null,
        status: "confirmed",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
    data.bookings.push(...bookings);
    const batchKey = options.notificationBatchKey || crypto.randomUUID();
    for (const channel of [...new Set(options.notificationChannels || [])]) {
      const job = normalizeNotificationJob({
        id: crypto.randomUUID(),
        dedupeKey: `${batchKey}:${channel}`,
        kind: channel === "email" ? "booking_created_email" : "booking_created_push",
        bookingIds: bookings.map((booking) => booking.id),
        status: "pending",
        attempts: 0,
        availableAt: timestamp,
        lockedAt: null,
        lastError: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      if (job && !data.notificationJobs.some((existing) => existing.dedupeKey === job.dedupeKey)) {
        data.notificationJobs.push(job);
      }
    }
    await writeData(data);
    return bookings;
  }

  async updateBooking(id: string, input: Partial<BookingInput & { status: Booking["status"] }>): Promise<Booking | null> {
    const data = await readData();
    const index = data.bookings.findIndex((booking) => booking.id === id);
    if (index < 0) {
      return null;
    }
    const existing = normalizeBooking(data.bookings[index]);
    const legacyAttachmentPatch =
      "attachmentFileName" in input || "attachmentMimeType" in input || "attachmentDataBase64" in input;
    const replacementAttachments = input.attachments !== undefined || legacyAttachmentPatch ? inputAttachments(input) : existing.attachments;
    const appendedAttachments = (input.appendAttachments || [])
      .map((attachment) => normalizeAttachment(attachment))
      .filter((attachment): attachment is BookingAttachment => Boolean(attachment));
    const removedIds = new Set(input.removeAttachmentIds || []);
    const nextAttachments = (input.clearAttachments ? [] : replacementAttachments)
      .filter((attachment) => !removedIds.has(attachment.id))
      .concat(appendedAttachments);
    const firstAttachment = nextAttachments[0] || null;
    const merged = normalizeBooking({
      ...existing,
      ...input,
      id,
      attachmentFileName: firstAttachment?.fileName || null,
      attachmentMimeType: firstAttachment?.mimeType || null,
      attachmentDataBase64: firstAttachment?.dataBase64 || null,
      attachments: nextAttachments,
      updatedAt: nowIso(),
    });
    const conflict = data.bookings.find(
      (booking) =>
        booking.id !== id &&
        merged.status !== "cancelled" &&
        booking.status !== "cancelled" &&
        overlaps(merged.startAtUtc, merged.endAtUtc, booking.startAtUtc, booking.endAtUtc)
    );
    if (conflict) {
      throw new Error("BOOKING_CONFLICT");
    }
    data.bookings[index] = merged;
    await writeData(data);
    return data.bookings[index];
  }

  async markBookingReminder24hSent(id: string, sentAt: string): Promise<Booking | null> {
    const data = await readData();
    const index = data.bookings.findIndex((booking) => booking.id === id);
    if (index < 0) {
      return null;
    }
    data.bookings[index] = normalizeBooking({
      ...data.bookings[index],
      reminder24hSentAt: data.bookings[index].reminder24hSentAt || sentAt,
      reminder24hLastError: null,
      updatedAt: nowIso(),
    });
    await writeData(data);
    return data.bookings[index];
  }

  async markBookingReminder24hFailed(id: string, error: string): Promise<Booking | null> {
    const data = await readData();
    const index = data.bookings.findIndex((booking) => booking.id === id);
    if (index < 0) {
      return null;
    }
    if (data.bookings[index].reminder24hSentAt) {
      return normalizeBooking(data.bookings[index]);
    }
    data.bookings[index] = normalizeBooking({
      ...data.bookings[index],
      reminder24hLastError: error.slice(0, 1000),
      updatedAt: nowIso(),
    });
    await writeData(data);
    return data.bookings[index];
  }

  async markBookingReminder1hSent(id: string, sentAt: string): Promise<Booking | null> {
    const data = await readData();
    const index = data.bookings.findIndex((booking) => booking.id === id);
    if (index < 0) {
      return null;
    }
    data.bookings[index] = normalizeBooking({
      ...data.bookings[index],
      reminder1hSentAt: data.bookings[index].reminder1hSentAt || sentAt,
      reminder1hLastError: null,
      updatedAt: nowIso(),
    });
    await writeData(data);
    return data.bookings[index];
  }

  async markBookingReminder1hFailed(id: string, error: string): Promise<Booking | null> {
    const data = await readData();
    const index = data.bookings.findIndex((booking) => booking.id === id);
    if (index < 0) {
      return null;
    }
    if (data.bookings[index].reminder1hSentAt) {
      return normalizeBooking(data.bookings[index]);
    }
    data.bookings[index] = normalizeBooking({
      ...data.bookings[index],
      reminder1hLastError: error.slice(0, 1000),
      updatedAt: nowIso(),
    });
    await writeData(data);
    return data.bookings[index];
  }

  async deleteBooking(id: string): Promise<boolean> {
    const data = await readData();
    const before = data.bookings.length;
    data.bookings = data.bookings.filter((booking) => booking.id !== id);
    data.notificationLogs = data.notificationLogs.filter((log) => log.bookingId !== id);
    await writeData(data);
    return data.bookings.length !== before;
  }

  async listPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
    const data = await readData();
    return data.pushSubscriptions
      .map((subscription) => normalizePushSubscription(subscription))
      .filter((subscription): subscription is PushSubscriptionRecord => Boolean(subscription))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async upsertPushSubscription(input: PushSubscriptionInput): Promise<PushSubscriptionRecord> {
    const data = await readData();
    const timestamp = nowIso();
    const existing = data.pushSubscriptions.find((subscription) => subscription.endpoint === input.endpoint);
    const subscription: PushSubscriptionRecord = {
      id: existing?.id || crypto.randomUUID(),
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent || null,
      lastError: null,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
    };
    if (existing) {
      data.pushSubscriptions = data.pushSubscriptions.map((current) => (current.id === existing.id ? subscription : current));
    } else {
      data.pushSubscriptions.push(subscription);
    }
    await writeData(data);
    return subscription;
  }

  async deletePushSubscription(id: string): Promise<boolean> {
    const data = await readData();
    const before = data.pushSubscriptions.length;
    data.pushSubscriptions = data.pushSubscriptions.filter((subscription) => subscription.id !== id);
    await writeData(data);
    return data.pushSubscriptions.length !== before;
  }

  async deletePushSubscriptionByEndpoint(endpoint: string): Promise<boolean> {
    const data = await readData();
    const before = data.pushSubscriptions.length;
    data.pushSubscriptions = data.pushSubscriptions.filter((subscription) => subscription.endpoint !== endpoint);
    await writeData(data);
    return data.pushSubscriptions.length !== before;
  }

  async markPushSubscriptionError(id: string, error: string): Promise<void> {
    const data = await readData();
    data.pushSubscriptions = data.pushSubscriptions.map((subscription) =>
      subscription.id === id ? { ...subscription, lastError: error.slice(0, 1000), updatedAt: nowIso() } : subscription
    );
    await writeData(data);
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
