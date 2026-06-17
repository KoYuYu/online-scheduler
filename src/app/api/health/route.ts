import { NextResponse } from "next/server";
import { getStore } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    await getStore().healthCheck();
    return NextResponse.json({
      ok: true,
      storage: process.env.DATABASE_URL ? "postgres" : "json",
    });
  } catch (error) {
    console.error("Health check failed.", error);
    return NextResponse.json(
      {
        ok: false,
        storage: process.env.DATABASE_URL ? "postgres" : "json",
        error: "storage_unavailable",
      },
      { status: 503 }
    );
  }
}
