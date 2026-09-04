if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for the integration acceptance suite");
  process.exit(1);
}
