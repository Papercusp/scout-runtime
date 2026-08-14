export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
  shouldRetry(error: unknown): boolean;
}

export interface RetryNotice {
  attempt: number;
  delayMs: number;
  error: unknown;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 2_000,
  jitterRatio: 0.2,
  shouldRetry: isTransientModelError,
};

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  onRetry?: (notice: RetryNotice) => Promise<void> | void,
): Promise<T> {
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1) {
    throw new RangeError('retry maxAttempts must be a positive integer');
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= policy.maxAttempts || !policy.shouldRetry(error)) throw error;

      const exponential = Math.min(
        policy.maxDelayMs,
        policy.baseDelayMs * 2 ** (attempt - 1),
      );
      const jitterWindow = exponential * policy.jitterRatio;
      const delayMs = Math.max(
        0,
        Math.round(exponential - jitterWindow + Math.random() * jitterWindow * 2),
      );
      await onRetry?.({ attempt, delayMs, error });
      await delay(delayMs);
    }
  }

  throw lastError;
}

export function isTransientModelError(error: unknown): boolean {
  const status = readStatus(error);
  if (status === 408 || status === 409 || status === 429 || (status !== undefined && status >= 500)) {
    return true;
  }

  if (!(error instanceof Error)) return false;
  const code = Reflect.get(error, 'code');
  return typeof code === 'string' && [
    'ECONNRESET',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ETIMEDOUT',
  ].includes(code);
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  for (const key of ['status', 'statusCode', 'code']) {
    const value = Reflect.get(error, key);
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && /^\d{3}$/.test(value)) return Number(value);
  }
  return undefined;
}

function delay(milliseconds: number): Promise<void> {
  if (milliseconds === 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
