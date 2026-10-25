'use client'
import { useSyncExternalStore } from 'react'

/**
 * Client-live participations presence for the portfolio page's all-zones-empty gate: the
 * onchain participations zone reads its rows through the wallet provider (SSR hasZoneData
 * is structurally empty on onchain builds), so the zone publishes whether its scan found
 * any row and the page-level ExploreCta subscribes — client-only zone data no longer
 * leaves the empty-state card up. Fixture builds never publish (their rows ride SSR
 * hasZoneData); the value persists across mobile tab switches (which unmount the zone)
 * and every scan completion overwrites it.
 */

let livePresent = false
const listeners = new Set<() => void>()

export function publishLiveParticipations(present: boolean) {
  if (livePresent === present) return
  livePresent = present
  listeners.forEach((listener) => listener())
}

export function useLiveParticipations(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => livePresent,
    () => false,
  )
}
