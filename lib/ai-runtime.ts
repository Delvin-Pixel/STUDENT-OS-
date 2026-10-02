const DEFAULT_MODEL = 'openai/gpt-5.6-sol';
const DEFAULT_TOTAL_TIMEOUT_MS = 120_000;
const DEFAULT_STEP_TIMEOUT_MS = 45_000;
const DEFAULT_CHUNK_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 1;

function boundedInteger(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function getModel() {
  const model = (process.env.NEXA_MODEL ?? DEFAULT_MODEL).trim();
  if (!model || model.length > 200 || !/^[A-Za-z0-9._:/-]+$/.test(model)) {
    throw new Error('NEXA_MODEL must be a non-empty model identifier using letters, numbers, dots, colons, slashes, underscores, or hyphens.');
  }
  return model;
}

export type NexaAiRuntimeConfig = {
  model: string;
  timeout: {
    totalMs: number;
    stepMs: number;
    chunkMs: number;
  };
  maxRetries: number;
};

export function getNexaAiRuntimeConfig(): NexaAiRuntimeConfig {
  const totalMs = boundedInteger('NEXA_AI_TOTAL_TIMEOUT_MS', DEFAULT_TOTAL_TIMEOUT_MS, 5_000, 600_000);
  const stepMs = boundedInteger('NEXA_AI_STEP_TIMEOUT_MS', DEFAULT_STEP_TIMEOUT_MS, 2_000, totalMs);
  const chunkMs = boundedInteger('NEXA_AI_CHUNK_TIMEOUT_MS', DEFAULT_CHUNK_TIMEOUT_MS, 1_000, stepMs);
  const maxRetries = boundedInteger('NEXA_AI_MAX_RETRIES', DEFAULT_MAX_RETRIES, 0, 2);
  return { model: getModel(), timeout: { totalMs, stepMs, chunkMs }, maxRetries };
}
