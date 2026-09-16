import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EXPORT_STATUS_FAST_POLL_PERIOD_MS,
  EXPORT_STATUS_POLL_INTERVAL_MS,
  EXPORT_STATUS_SLOW_POLL_INTERVAL_MS,
} from '@/constants/channel-export';
import { useChannelExport } from '@/hooks/use-channel-export';
import type { ChannelArchiveStatus } from '@/types/channel-export';
import { downloadChannelExportArchive } from '@/utils/documents/download';

vi.mock('@/utils/documents/download', () => ({
  downloadChannelExportArchive: vi.fn(),
}));

/** A `fetch` stand-in resolving the status endpoint with the given statuses, in order. */
function mockStatuses(...statuses: ChannelArchiveStatus[]) {
  const fetchMock = vi.fn();
  for (const status of statuses) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status }),
    });
  }
  // Any extra poll repeats the last status rather than rejecting.
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ status: statuses[statuses.length - 1] }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Advances the fake clock and lets the resulting promise chain settle. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/**
 * Settles the in-flight fetch without moving the clock. Testing Library's `waitFor` polls on real
 * timers, so it can never observe progress while the fake clock is installed — flushing the
 * microtask queue is the equivalent here.
 */
async function flush() {
  await advance(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useChannelExport', () => {
  it('reads the status once on mount', async () => {
    const fetchMock = mockStatuses('not_found');

    const { result } = renderHook(() =>
      useChannelExport({ applicationId: 'app-1' }),
    );

    await flush();
    expect(result.current.status).toBe('not_found');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/export/status?applicationId=app-1',
    );
  });

  it('does nothing without an applicationId or when disabled', async () => {
    const fetchMock = mockStatuses('ready');

    renderHook(() => useChannelExport({ applicationId: undefined }));
    renderHook(() =>
      useChannelExport({ applicationId: 'app-1', enabled: false }),
    );

    await advance(EXPORT_STATUS_POLL_INTERVAL_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('polls while the status is pending and stops once it settles', async () => {
    const fetchMock = mockStatuses('pending', 'pending', 'ready');

    const { result } = renderHook(() =>
      useChannelExport({ applicationId: 'app-1' }),
    );

    await flush();
    expect(result.current.status).toBe('pending');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advance(EXPORT_STATUS_POLL_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await advance(EXPORT_STATUS_POLL_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await flush();
    expect(result.current.status).toBe('ready');

    // Settled: no further polls, however long we wait.
    await advance(EXPORT_STATUS_SLOW_POLL_INTERVAL_MS * 4);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not poll a settled status', async () => {
    const fetchMock = mockStatuses('not_found');

    renderHook(() => useChannelExport({ applicationId: 'app-1' }));

    await advance(EXPORT_STATUS_SLOW_POLL_INTERVAL_MS * 4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('widens the poll interval once the job outlives the fast period', async () => {
    const fetchMock = mockStatuses('pending');

    const { result } = renderHook(() =>
      useChannelExport({ applicationId: 'app-1' }),
    );
    await flush();
    expect(result.current.status).toBe('pending');

    // Burn through the fast period at the brisk interval.
    await advance(EXPORT_STATUS_FAST_POLL_PERIOD_MS);
    const callsAtSwitchover = fetchMock.mock.calls.length;

    // The brisk interval no longer applies, so nothing fires until the slow one elapses.
    await advance(EXPORT_STATUS_POLL_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(callsAtSwitchover);

    await advance(
      EXPORT_STATUS_SLOW_POLL_INTERVAL_MS - EXPORT_STATUS_POLL_INTERVAL_MS,
    );
    expect(fetchMock).toHaveBeenCalledTimes(callsAtSwitchover + 1);
  });

  it('stops polling on unmount', async () => {
    const fetchMock = mockStatuses('pending');

    const { result, unmount } = renderHook(() =>
      useChannelExport({ applicationId: 'app-1' }),
    );
    await flush();
    expect(result.current.status).toBe('pending');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();

    await advance(EXPORT_STATUS_SLOW_POLL_INTERVAL_MS * 4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed status check as an error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({
        error: 'Failed to read the channel export status',
        errorDetail: 'upstream 422',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useChannelExport({ applicationId: 'app-1' }),
    );

    await flush();
    expect(result.current.error).toEqual({
      text: 'Failed to read the channel export status',
      full: 'upstream 422',
    });
    expect(result.current.status).toBeNull();
  });

  describe('prepare', () => {
    it('PUTs the trigger route and starts polling from the returned status', async () => {
      const fetchMock = mockStatuses('not_found');
      const { result } = renderHook(() =>
        useChannelExport({ applicationId: 'app-1' }),
      );
      await flush();
      expect(result.current.status).toBe('not_found');

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ status: 'pending' }),
      });
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'pending' }),
      });

      await act(async () => {
        await result.current.prepare();
      });

      expect(fetchMock.mock.calls[1][0]).toBe(
        '/api/export?applicationId=app-1',
      );
      expect(fetchMock.mock.calls[1][1]).toEqual({ method: 'PUT' });
      expect(result.current.status).toBe('pending');

      // The trigger response seeds the poll loop.
      await advance(EXPORT_STATUS_POLL_INTERVAL_MS);
      expect(fetchMock.mock.calls[2][0]).toBe(
        '/api/export/status?applicationId=app-1',
      );
    });

    it('surfaces a failed trigger as an error and leaves the status alone', async () => {
      const fetchMock = mockStatuses('not_found');
      const { result } = renderHook(() =>
        useChannelExport({ applicationId: 'app-1' }),
      );
      await flush();
      expect(result.current.status).toBe('not_found');

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ error: 'Failed to start the channel export' }),
      });

      await act(async () => {
        await result.current.prepare();
      });

      expect(result.current.error).toEqual({
        text: 'Failed to start the channel export',
        full: undefined,
      });
      expect(result.current.status).toBe('not_found');
      expect(result.current.isPreparing).toBe(false);
    });
  });

  it('download triggers the archive download with the fallback filename', async () => {
    mockStatuses('ready');
    const { result } = renderHook(() =>
      useChannelExport({ applicationId: 'app-1' }),
    );
    await flush();
    expect(result.current.status).toBe('ready');

    act(() => result.current.download());

    expect(downloadChannelExportArchive).toHaveBeenCalledWith(
      'app-1',
      'channel-export.zip',
    );
  });
});
