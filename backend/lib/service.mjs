import { ZodError } from "zod";
import { InputSchema, OutputSchema } from "../../shared/schema.mjs";
import { buildPrompt, buildCorrectionPrompt } from "./prompt.mjs";
import { generateWithGemini } from "./model.mjs";
import { applyGuardrails } from "./guardrails.mjs";

function parseJson(jsonText) {
  return JSON.parse(jsonText);
}

function zodIssues(error) {
  if (error instanceof ZodError) {
    return error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; ");
  }
  return String(error?.message || error);
}

export async function processRequest(input) {
  const validInput = InputSchema.parse(input);

  const firstPrompt = buildPrompt(validInput);
  let raw = await generateWithGemini(firstPrompt);

  try {
    const parsed = parseJson(raw);
    const validated = OutputSchema.parse(parsed);
    return applyGuardrails(validInput, validated);
  } catch (err) {
    const correctionPrompt = buildCorrectionPrompt(validInput, raw, zodIssues(err));
    raw = await generateWithGemini(correctionPrompt);
    const parsedRetry = parseJson(raw);
    const validatedRetry = OutputSchema.parse(parsedRetry);
    return applyGuardrails(validInput, validatedRetry);
  }
}
