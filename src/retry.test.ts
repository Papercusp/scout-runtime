import { describe, expect, it, vi } from 'vitest';
import { isTransientModelError, withRetry, type RetryPolicy } from './retry.js';

const immediatePolicy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 0,
  maxDelayMs: 0,
  jitterRatio: 0,
  shouldRetry: isTransientModelError,
};

describe('withRetry', () => {
  it('retries transient provider errors and reports each retry', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('busy'), { status: 503 }))
      .mockResolvedValue('ok');
    const onRetry = vi.fn();

    await expect(withRetry(operation, immediatePolicy, onRetry)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, delayMs: 0 }));
  });

  it('does not retry permanent provider errors', async () => {
    const operation = vi.fn().mockRejectedValue(Object.assign(new Error('bad request'), { status: 400 }));
    await expect(withRetry(operation, immediatePolicy)).rejects.toThrow('bad request');
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
