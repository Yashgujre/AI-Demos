const dayBuckets = new Map();
const DAILY_CAP = Number(process.env.DAILY_IP_CAP || 40);

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function checkIpRateLimit(ip) {
  const key = `${dayKey()}::${ip || "unknown"}`;
  const count = dayBuckets.get(key) || 0;
  if (count >= DAILY_CAP) {
    return { allowed: false, remaining: 0, limit: DAILY_CAP };
  }

  dayBuckets.set(key, count + 1);
  return { allowed: true, remaining: DAILY_CAP - (count + 1), limit: DAILY_CAP };
}
