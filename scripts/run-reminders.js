const rawAppUrl = process.env.APP_URL || "";
const cronSecret = process.env.CRON_SECRET;

function safeValue(value) {
  return value.replace(/([?&](secret|token|key)=)[^&]+/gi, "$1***");
}

function parseAppUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("APP_URL is not set.");
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`APP_URL is invalid: "${safeValue(trimmed)}". Use a full URL like https://your-app.up.railway.app`);
  }

  if (!["http:", "https:"].includes(url.protocol) || url.hostname === "http" || url.hostname === "https") {
    throw new Error(`APP_URL is invalid: "${safeValue(trimmed)}". Use exactly one protocol, for example https://your-app.up.railway.app`);
  }

  return url.origin;
}

async function main() {
  const appUrl = parseAppUrl(rawAppUrl);
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
