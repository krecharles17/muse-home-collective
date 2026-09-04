// Minimal server-side API for the Neon PostgreSQL catalog.
// DATABASE_URL lives here and ONLY here — it is never imported by browser
// code and never reaches the Vite bundle (no VITE_ prefix anywhere).
import postgres from "postgres";

export interface ApiRequest {
  method: string;
  url: string;
}

export interface ApiResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

export type Sql = postgres.Sql;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function createApp(sql: Sql) {
  return async function handle(req: ApiRequest): Promise<ApiResponse> {
    const headers = { "Content-Type": "application/json", ...CORS_HEADERS };
    const route = new URL(req.url, "http://localhost").pathname;

    if (req.method === "OPTIONS") {
      return { status: 204, body: "", headers };
    }

    try {
      if (req.method === "GET" && route === "/api/health") {
        await sql`SELECT 1`;
        return { status: 200, body: JSON.stringify({ ok: true, db: "up" }), headers };
      }

      if (req.method === "GET" && route === "/api/collections") {
        const rows = await sql`
          SELECT id, name, slug, description, image, hero_image AS "heroImage", sort_order
          FROM collections ORDER BY sort_order ASC
        `;
        return { status: 200, body: JSON.stringify(rows), headers };
      }

      if (req.method === "GET" && route === "/api/products") {
        const rows = await sql`
          SELECT id, name, slug, collection_id AS "collection", price, description,
                 long_description AS "longDescription", materials, dimensions, images,
                 stock, rating, review_count AS "reviewCount", featured, is_new AS "new"
          FROM products ORDER BY created_at ASC, id ASC
        `;
        return { status: 200, body: JSON.stringify(rows), headers };
      }

      return { status: 404, body: JSON.stringify({ error: "not found" }), headers };
    } catch (err) {
      console.error(`[api] ${req.method} ${route} failed`, err);
      return {
        status: 503,
        body: JSON.stringify({ error: "database unavailable" }),
        headers,
      };
    }
  };
}

