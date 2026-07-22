import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger, logger } from '@/utils/logger';

describe('createLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefixes messages with [generic-rag] when unscoped', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    createLogger().info('hello', { a: 1 });
    expect(infoSpy).toHaveBeenCalledWith('[generic-rag]', 'hello', { a: 1 });
  });

  it('prefixes messages with [generic-rag][scope] when scoped', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    createLogger('embedding').debug('hello');
    expect(debugSpy).toHaveBeenCalledWith('[generic-rag][embedding]', 'hello');
  });

  it.each(['debug', 'info', 'warn', 'error'] as const)(
    'delegates %s to the matching console method',
    (level) => {
      const spy = vi.spyOn(console, level).mockImplementation(() => {});
      createLogger('scope')[level]('msg');
      expect(spy).toHaveBeenCalledWith('[generic-rag][scope]', 'msg');
    },
  );

  it('exports a default unscoped logger', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('careful');
    expect(warnSpy).toHaveBeenCalledWith('[generic-rag]', 'careful');
  });
});
