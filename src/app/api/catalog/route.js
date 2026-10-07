import { NextResponse } from "next/server";
import { fetchFullCatalog } from "@/lib/data-fetcher-server";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
};

export async function GET() {
  try {
    return NextResponse.json(
      { products: await fetchFullCatalog() },
      { headers }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Catalog request failed" },
      { status: 500, headers }
    );
  }
}
