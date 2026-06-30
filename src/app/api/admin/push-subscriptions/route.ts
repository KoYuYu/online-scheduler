import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getWebPushPublicKey } from "@/lib/push";
import { getStore } from "@/lib/storage";
import type { PushSubscriptionInput } from "@/lib/types";

export const runtime = "nodejs";

function summarizeEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return `${url.hostname}${url.pathname.slice(0, 12)}...`;
  } catch {
    return `${endpoint.slice(0, 20)}...`;
  }
}

function parsePushSubscription(body: unknown): PushSubscriptionInput | null {
  const value = body as {
    subscription?: Partial<PushSubscriptionInput>;
    endpoint?: string;
    keys?: Partial<PushSubscriptionInput["keys"]>;
    userAgent?: string;
  };
  const subscription = value.subscription || value;
  const endpoint = typeof subscription.endpoint === "string" ? subscription.endpoint : "";
  const keys = subscription.keys || {};
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys.auth === "string" ? keys.auth : "";
  if (!endpoint || !p256dh || !auth) {
    return null;
  }
  return {
    endpoint,
    keys: { p256dh, auth },
    userAgent: typeof value.userAgent === "string" ? value.userAgent : null,
  };
}

export async function GET(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: "未登入或權限不足。" }, { status: 401 });
  }

  const subscriptions = await getStore().listPushSubscriptions();
  return NextResponse.json({
    publicKey: getWebPushPublicKey(),
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      endpointLabel: summarizeEndpoint(subscription.endpoint),
      userAgent: subscription.userAgent,
      lastError: subscription.lastError,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: "未登入或權限不足。" }, { status: 401 });
  }

  const input = parsePushSubscription(await request.json());
  if (!input) {
    return NextResponse.json({ error: "推送訂閱資料不完整。" }, { status: 400 });
  }

  const subscription = await getStore().upsertPushSubscription(input);
  return NextResponse.json({
    subscription: {
      id: subscription.id,
      endpointLabel: summarizeEndpoint(subscription.endpoint),
      userAgent: subscription.userAgent,
      lastError: subscription.lastError,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    },
  });
}
