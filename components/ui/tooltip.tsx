"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

// base-ui Tooltip has only two open paths: mouse hover (the hover interaction is mouseOnly, touch
// is filtered) and keyboard :focus-visible focus (touch taps never match). A touch tap needs a
// controlled open to toggle the bubble; tapping outside the bubble closes via Root's built-in
// outsidePress, no extra code needed.
type TouchTooltipApi = {
  rememberPointerType: (pointerType: string) => void
  handleTriggerClick: () => void
}

const TouchTooltipContext = React.createContext<TouchTooltipApi | null>(null)

// Guard window after a touch-tap open: when a Chromium touch tap ends it returns the synthetic
// hover to its origin, emitting mouseout/mouseleave on the trigger; without a veto the bubble
// would be closed as a hover-leave within ~20ms of opening
const TOUCH_OPEN_GUARD_MS = 350

function Tooltip({
  defaultOpen,
  open: openProp,
  onOpenChange,
  ...props
}: TooltipPrimitive.Root.Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false)
  const isControlled = openProp !== undefined
  const pointerTypeRef = React.useRef<string | undefined>(undefined)
  const touchOpenGuardRef = React.useRef(0)

  const touchApi = React.useMemo<TouchTooltipApi>(
    () => ({
      rememberPointerType(pointerType) {
        pointerTypeRef.current = pointerType
      },
      handleTriggerClick() {
        // Consume-and-clear: the click synthesized by keyboard Enter/Space has no preceding
        // pointerdown, so the last verdict must not be reused
        const pointerType = pointerTypeRef.current
        pointerTypeRef.current = undefined
        if (isControlled) {
          return
        }
        if (pointerType === "touch") {
          setUncontrolledOpen((open) => {
            if (!open) {
              touchOpenGuardRef.current = Date.now() + TOUCH_OPEN_GUARD_MS
            }
            return !open
          })
        } else if (pointerType !== undefined) {
          // Mouse/pen click on the trigger = close, keeping base-ui's original closeOnClick semantics
          setUncontrolledOpen(false)
        }
      },
    }),
    [isControlled],
  )

  return (
    <TouchTooltipContext.Provider value={touchApi}>
      <TooltipPrimitive.Provider delay={0} closeDelay={0}>
        <TooltipPrimitive.Root
          open={isControlled ? openProp : uncontrolledOpen}
          onOpenChange={(open, eventDetails) => {
            if (
              !open &&
              eventDetails.reason === "trigger-hover" &&
              Date.now() < touchOpenGuardRef.current
            ) {
              // After cancel the store never records the closed state, so the bubble stays open
              eventDetails.cancel()
              return
            }
            if (!isControlled) {
              setUncontrolledOpen(open)
            }
            onOpenChange?.(open, eventDetails)
          }}
          {...props}
        />
      </TooltipPrimitive.Provider>
    </TouchTooltipContext.Provider>
  )
}

function TooltipTrigger({
  closeOnClick = false,
  onPointerDown,
  onClick,
  ...props
}: TooltipPrimitive.Trigger.Props) {
  const touchTooltip = React.useContext(TouchTooltipContext)
  // closeOnClick is pinned to false: with base-ui's default true, the same touch tap gets closed
  // first by useDismiss's referencePress on pointerdown and reopened by our click, so it could
  // never be closed
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      closeOnClick={closeOnClick}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        touchTooltip?.rememberPointerType(event.pointerType)
      }}
      onClick={(event) => {
        onClick?.(event)
        touchTooltip?.handleTriggerClick()
      }}
      {...props}
    />
  )
}

type TooltipSide = React.ComponentProps<typeof TooltipPrimitive.Positioner>["side"]

function TooltipContent({
  sideOffset = 6,
  side,
  ...props
}: TooltipPrimitive.Popup.Props & { sideOffset?: number; side?: TooltipSide }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset} className="z-50">
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className="z-50 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent }
