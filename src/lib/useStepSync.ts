import { useCallback, useEffect, useRef, useState } from 'react'
import { readPedometer, readRawCounter, type StepSource } from './nativeSteps'

export type SyncState = {
  source: StepSource
  label: string
  reason: string
  counter: number | null
  /** Time the current baseline started, when today's count began mid-day. */
  since: string | null
  lastSync: number | null
  rebooted: boolean
}

const POLL_MS = 12000

/**
 * Keeps today's step total in sync with the phone's own step counter.
 *
 * The counter is cumulative since boot and advances while the app is closed, so a
 * single read on open (and a light poll while the app is in front) is enough to
 * report the day's real total — no background service, no login, no cloud.
 */
export function useStepSync({
  enabled,
  onTodaySteps,
  onHistory,
}: {
  enabled: boolean
  /** Authoritative total for today. Callers should never lower a stored value. */
  onTodaySteps: (steps: number) => void
  /** Daily totals banked at midnight while the app was closed. */
  onHistory: (days: Record<string, number>) => void
}) {
  const [state, setState] = useState<SyncState>({
    source: 'none',
    label: 'Starting',
    reason: '',
    counter: null,
    since: null,
    lastSync: null,
    rebooted: false,
  })

  const onTodayRef = useRef(onTodaySteps)
  const onHistoryRef = useRef(onHistory)
  onTodayRef.current = onTodaySteps
  onHistoryRef.current = onHistory

  const sync = useCallback(async () => {
    const result = await readPedometer()
    if (!result.ok) {
      setState((prev) => ({
        ...prev,
        source: 'none',
        label: 'No step counter',
        reason: result.reason,
      }))
      return
    }

    const { reading } = result
    onTodayRef.current(reading.steps)
    if (reading.history) onHistoryRef.current(reading.history)

    setState({
      source: 'pedometer',
      label: 'Phone step counter',
      reason: '',
      counter: reading.counter,
      since: reading.baselineStartedNow ? reading.since ?? null : null,
      lastSync: Date.now(),
      rebooted: reading.rebooted,
    })
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    void sync()

    const tick = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    const id = window.setInterval(tick, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      void cancelled
    }
  }, [enabled, sync])

  return { ...state, sync }
}

/** Raw counter for the diagnostics panel. */
export function useRawCounter(active: boolean) {
  const [counter, setCounter] = useState<number | null>(null)
  useEffect(() => {
    if (!active) return
    let alive = true
    const run = async () => {
      const value = await readRawCounter()
      if (alive) setCounter(value)
    }
    void run()
    const id = window.setInterval(run, 15000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [active])
  return counter
}
