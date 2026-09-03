// HTTP entrypoint for the catalog API. Run with: npm run server
import http from "node:http";
import postgres from "postgres";
import { createApp } from "./app.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required to start the API server.");
  console.error("Copy .env.example to .env and set it (server-side only — never a VITE_ variable).");
  process.exit(2);
}

const sql = postgres(DATABASE_URL, {
  prepare: false, // Neon pooler compatibility
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

const handle = createApp(sql);
const port = Number(process.env.PORT || 3001);

const server = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    handle({ method: req.method ?? "GET", url: req.url ?? "/" })
      .then((res_) => {
        res.writeHead(res_.status, res_.headers);
        res.end(res_.body);
      })
      .catch((err) => {
        console.error("[api] unhandled", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal error" }));
      });
  });
});

server.listen(port, () => {
  console.log(`muse API listening on http://localhost:${port}`);
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down`);
  server.close();
  await sql.end({ timeout: 2 });
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
