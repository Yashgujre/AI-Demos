import { ZodError } from "zod";
import { processRequest } from "../lib/service.mjs";
import { checkIpRateLimit } from "../lib/rate-limit.mjs";
import { INVALID_USER_API_KEY_MESSAGE, MODEL_TIMEOUT_MESSAGE } from "../lib/model.mjs";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
let hasLoggedOpenCorsWarning = false;

function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type,X-User-API-Key",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
  };

  if (ALLOWED_ORIGINS.length === 0) {
    if (!hasLoggedOpenCorsWarning) {
      console.warn("[Policy Copilot] WARNING: ALLOWED_ORIGINS is empty. Allowing all origins.");
      hasLoggedOpenCorsWarning = true;
    }
    headers["Access-Control-Allow-Origin"] = origin || "*";
    return headers;
  }

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function send(res, status, body, origin) {
  res.statusCode = status;
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(body));
}

function readUserApiKey(req) {
  const headerValue = req.headers["x-user-api-key"];
  if (Array.isArray(headerValue)) {
    return String(headerValue[0] || "").trim();
  }
  return String(headerValue || "").trim();
}

function isJsonContentType(req) {
  const contentType = String(req.headers["content-type"] || "");
  return contentType.toLowerCase().includes("application/json");
}

function sanitizeErrorDetails(error, userApiKey) {
  const detail = String(error?.message || error);
  if (!userApiKey) return detail;
  return detail.split(userApiKey).join("[REDACTED]");
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

  if (!isJsonContentType(req)) {
    return send(
      res,
      415,
      {
        error_code: "BAD_REQUEST",
        message: "Unsupported content type",
        details: "Expected Content-Type: application/json.",
      },
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

  const userApiKey = readUserApiKey(req);
  if (!userApiKey) {
    const ip = getIp(req);
    const rate = await checkIpRateLimit(ip);
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
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const output = await processRequest(payload, { userApiKey: userApiKey || undefined });
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

    if (
      error?.name === "InvalidUserApiKeyError"
      || String(error?.message || "").includes(INVALID_USER_API_KEY_MESSAGE)
    ) {
      return send(
        res,
        400,
        {
          error_code: "BAD_REQUEST",
          message: "Invalid API key provided.",
          details:
            "The Gemini API rejected the provided key. Please check that it is valid and has the Generative Language API enabled.",
        },
        origin,
      );
    }

    return send(
      res,
      500,
      {
        error_code: "MODEL_ERROR",
        message:
          String(error?.message || "").includes(MODEL_TIMEOUT_MESSAGE)
            ? MODEL_TIMEOUT_MESSAGE
            : "Failed to generate action plan.",
        details: sanitizeErrorDetails(error, userApiKey),
      },
      origin,
    );
  }
}
