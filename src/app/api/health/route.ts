import { NextResponse } from "next/server";
import { getStore } from "@/lib/storage";
import { PostgresStore } from "@/lib/storage/postgres-store";

export const runtime = "nodejs";

export async function GET() {
  const store = getStore();

  if (!(store instanceof PostgresStore)) {
    return NextResponse.json({ status: "ok", store: "json" });
  }

  try {
    await store.testConnection();
    return NextResponse.json({ status: "ok", store: "postgres" });
  } catch (error) {
    console.error("[health] Database connection check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        store: "postgres",
        message: error instanceof Error ? error.message : "Database connection failed",
      },
      { status: 503 }
    );
  }
}
