const dayBuckets = new Map();
const DAILY_CAP = Number(process.env.DAILY_IP_CAP || 40);
const TTL_SECONDS = 86400;

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function redisIncrWithTtl(key) {
  const config = getRedisConfig();
  if (!config) return null;

  const headers = {
    Authorization: `Bearer ${config.token}`,
    "Content-Type": "application/json",
  };

  // Atomicity matters: the old INCR-then-EXPIRE flow can lose TTL under concurrent
  // first writes. Initializing with SET NX EX guarantees TTL is attached at creation.
  const initRes = await fetch(
    `${config.url}/set/${encodeURIComponent(key)}/0/EX/${TTL_SECONDS}/NX`,
    { method: "POST", headers },
  );
  if (!initRes.ok) {
    throw new Error(`KV SET NX EX failed with status ${initRes.status}`);
  }

  const incrRes = await fetch(`${config.url}/incr/${encodeURIComponent(key)}`, {
    method: "POST",
    headers,
  });
  if (!incrRes.ok) {
    throw new Error(`KV INCR failed with status ${incrRes.status}`);
  }

  const incrPayload = await incrRes.json();
  const count = Number(incrPayload?.result);
  if (!Number.isFinite(count)) {
    throw new Error("KV INCR returned non-numeric result");
  }

  return count;
}

function inMemoryRateLimit(key) {
  const count = dayBuckets.get(key) || 0;
  if (count >= DAILY_CAP) {
    return { allowed: false, remaining: 0, limit: DAILY_CAP };
  }

  dayBuckets.set(key, count + 1);
  return { allowed: true, remaining: DAILY_CAP - (count + 1), limit: DAILY_CAP };
}

export async function checkIpRateLimit(ip) {
  const key = `${dayKey()}::${ip || "unknown"}`;

  try {
    const count = await redisIncrWithTtl(key);
    if (count == null) {
      return inMemoryRateLimit(key);
    }

    if (count > DAILY_CAP) {
      return { allowed: false, remaining: 0, limit: DAILY_CAP };
    }

    return {
      allowed: true,
      remaining: DAILY_CAP - count,
      limit: DAILY_CAP,
    };
  } catch {
    return inMemoryRateLimit(key);
  }
}
