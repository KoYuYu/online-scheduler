const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
const cronSecret = process.env.CRON_SECRET;

async function main() {
  if (!appUrl) {
    throw new Error("APP_URL is not set.");
  }
  if (!cronSecret) {
    throw new Error("CRON_SECRET is not set.");
  }

  const response = await fetch(`${appUrl}/api/cron/reminders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  console.log(text);

  if (!response.ok) {
    throw new Error(`Reminder cron failed with ${response.status}.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
