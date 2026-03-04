import { ZodError } from "zod";
import { processRequest } from "../lib/service.mjs";
import { checkIpRateLimit } from "../lib/rate-limit.mjs";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin) ? origin || "*" : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
  };
}

function send(res, status, body, origin) {
  res.statusCode = status;
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  const origin = req.headers.origin;

  if (req.method === "OPTIONS") {
    return send(res, 200, { ok: true }, origin);
  }

  if (req.method !== "POST") {
    return send(
      res,
      405,
      { error_code: "BAD_REQUEST", message: "Method not allowed", details: "Use POST /api/generate" },
      origin,
    );
  }

  const size = Number(req.headers["content-length"] || 0);
  if (size > 60_000) {
    return send(
      res,
      413,
      { error_code: "BAD_REQUEST", message: "Payload too large", details: "Max 60KB request size." },
      origin,
    );
  }

  const ip = getIp(req);
  const rate = checkIpRateLimit(ip);
  if (!rate.allowed) {
    return send(
      res,
      429,
      {
        error_code: "RATE_LIMITED",
        message: "Daily public demo cap reached.",
        details: "Please try again tomorrow.",
      },
      origin,
    );
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const output = await processRequest(payload);
    return send(res, 200, output, origin);
  } catch (error) {
    if (error instanceof ZodError) {
      return send(
        res,
        400,
        {
          error_code: "VALIDATION_FAILED",
          message: "Input or model output failed validation.",
          details: error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; "),
        },
        origin,
      );
    }

    return send(
      res,
      500,
      {
        error_code: "MODEL_ERROR",
        message: "Failed to generate action plan.",
        details: String(error?.message || error),
      },
      origin,
    );
  }
}
