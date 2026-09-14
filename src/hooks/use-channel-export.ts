'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CHANNEL_EXPORT_FALLBACK_FILENAME,
  EXPORT_STATUS_FAST_POLL_PERIOD_MS,
  EXPORT_STATUS_POLL_INTERVAL_MS,
  EXPORT_STATUS_SLOW_POLL_INTERVAL_MS,
} from '@/constants/channel-export';
import type {
  ChannelArchiveResponse,
  ChannelArchiveStatus,
} from '@/types/channel-export';
import { channelLogger } from '@/utils/channel/logger';
import { downloadChannelExportArchive } from '@/utils/documents/download';

/** A request failure — distinct from a `status: 'error'`, which the channel reports via `status`. */
interface ChannelExportError {
  /** Concise one-line message for display. */
  text: string;
  /** Verbose diagnostic, revealed on hover when the channel supplied one. */
  full?: string;
}

export interface ChannelExport {
  /** The archive state, or `null` until the first status check resolves. */
  status: ChannelArchiveStatus | null;
  /** The trigger request is in flight. */
  isPreparing: boolean;
  error: ChannelExportError | null;
  /** Triggers archive preparation and resumes polling from the returned status. */
  prepare: () => Promise<void>;
  /** Starts the browser download of a `ready` archive. */
  download: () => void;
}

async function readErrorBody(
  response: Response,
  fallback: string,
): Promise<ChannelExportError> {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    errorDetail?: string;
  } | null;
  return { text: body?.error ?? fallback, full: body?.errorDetail };
}

/**
 * Drives the two-step channel export: reads the archive status, triggers preparation, and polls
 * while the channel reports `pending` (briskly at first, then slower — see
 * `@/constants/channel-export`). Polling lives entirely in this hook and is scoped to the caller's
 * lifetime: unmounting clears the pending timer and aborts the in-flight check, and mounting again
 * resumes from a fresh status read.
 *
 * `enabled` gates all activity, so a caller can mount the hook before it has anything to poll for.
 */
export function useChannelExport({
  applicationId,
  enabled = true,
}: {
  applicationId: string | undefined;
  enabled?: boolean;
}): ChannelExport {
  const [status, setStatus] = useState<ChannelArchiveStatus | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<ChannelExportError | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // When `pending` was first observed, so the interval can widen for a long-running job.
  const pendingSinceRef = useRef<number | null>(null);
  // Holds the latest `checkStatus` so the self-rescheduling timer never calls a stale closure.
  const checkRef = useRef<(() => void) | null>(null);
  // Guards every `setState` after an await: the hook may have unmounted in the meantime.
  const mountedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleNextCheck = useCallback(() => {
    const pendingSince = pendingSinceRef.current;
    const elapsed = pendingSince === null ? 0 : Date.now() - pendingSince;
    const delay =
      elapsed < EXPORT_STATUS_FAST_POLL_PERIOD_MS
        ? EXPORT_STATUS_POLL_INTERVAL_MS
        : EXPORT_STATUS_SLOW_POLL_INTERVAL_MS;

    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      checkRef.current?.();
    }, delay);
  }, [clearTimer]);

  /** Records a resolved status and, while it stays `pending`, arms the next poll. */
  const applyStatus = useCallback(
    (next: ChannelArchiveStatus) => {
      setStatus(next);
      if (next === 'pending') {
        if (pendingSinceRef.current === null) {
          pendingSinceRef.current = Date.now();
        }
        scheduleNextCheck();
        return;
      }
      // Any settled status ends the poll loop; a later `prepare()` restarts it from scratch.
      pendingSinceRef.current = null;
      clearTimer();
    },
    [clearTimer, scheduleNextCheck],
  );

  const checkStatus = useCallback(async () => {
    if (!applicationId) {
      return;
    }
    // Supersede any in-flight check so a slow response cannot overwrite a newer one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams({ applicationId });
    try {
      const response = await fetch(`/api/export/status?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!mountedRef.current) {
        return;
      }
      if (!response.ok) {
        setError(
          await readErrorBody(
            response,
            'Failed to read the export status. Please try again.',
          ),
        );
        return;
      }
      const body = (await response.json()) as ChannelArchiveResponse;
      if (!mountedRef.current) {
        return;
      }
      setError(null);
      applyStatus(body.status);
    } catch (reason: unknown) {
      // An aborted check was superseded or the hook unmounted — neither is a failure to report.
      if (controller.signal.aborted) {
        return;
      }
      channelLogger.warn('failed to read channel export status', {
        applicationId,
        reason: reason instanceof Error ? reason.message : String(reason),
      });
      if (mountedRef.current) {
        setError({
          text: 'Failed to read the export status. Please try again.',
        });
      }
    }
  }, [applicationId, applyStatus]);

  // Keep the timer's entry point pointed at the current `checkStatus` without making the poll loop
  // (below) depend on its identity, which changes every time a check resolves.
  useEffect(() => {
    checkRef.current = () => {
      void checkStatus();
    };
  }, [checkStatus]);

  const prepare = useCallback(async () => {
    if (!applicationId) {
      return;
    }
    const params = new URLSearchParams({ applicationId });
    setIsPreparing(true);
    setError(null);
    try {
      const response = await fetch(`/api/export?${params.toString()}`, {
        method: 'PUT',
      });
      if (!mountedRef.current) {
        return;
      }
      if (!response.ok) {
        setError(
          await readErrorBody(
            response,
            'Failed to start the export. Please try again.',
          ),
        );
        return;
      }
      const body = (await response.json()) as ChannelArchiveResponse;
      if (!mountedRef.current) {
        return;
      }
      // Preparation restarts the clock, so a fresh job always gets the brisk interval.
      pendingSinceRef.current = null;
      applyStatus(body.status);
    } catch (reason: unknown) {
      channelLogger.warn('failed to trigger channel export', {
        applicationId,
        reason: reason instanceof Error ? reason.message : String(reason),
      });
      if (mountedRef.current) {
        setError({ text: 'Failed to start the export. Please try again.' });
      }
    } finally {
      if (mountedRef.current) {
        setIsPreparing(false);
      }
    }
  }, [applicationId, applyStatus]);

  const download = useCallback(() => {
    if (!applicationId) {
      return;
    }
    downloadChannelExportArchive(
      applicationId,
      CHANNEL_EXPORT_FALLBACK_FILENAME,
    );
  }, [applicationId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled || !applicationId) {
      return;
    }
    checkRef.current?.();

    return () => {
      mountedRef.current = false;
      clearTimer();
      abortRef.current?.abort();
      abortRef.current = null;
      pendingSinceRef.current = null;
    };
    // `checkStatus` is reached through `checkRef` rather than being a dependency: its identity
    // changes whenever a poll resolves, which would otherwise tear down and restart the loop on
    // every tick.
  }, [applicationId, enabled, clearTimer]);

  return { status, isPreparing, error, prepare, download };
}
