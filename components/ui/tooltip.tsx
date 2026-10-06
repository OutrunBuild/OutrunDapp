"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

// base-ui Tooltip 只有两条打开路径：鼠标悬停（悬停交互 mouseOnly，touch 被过滤）
// 与键盘 :focus-visible 聚焦（触屏点按永不匹配）。触屏点按需受控 open 才能开关气泡；
// 气泡外点按关闭走 Root 内建 outsidePress，无需另写。
type TouchTooltipApi = {
  rememberPointerType: (pointerType: string) => void
  handleTriggerClick: () => void
}

const TouchTooltipContext = React.createContext<TouchTooltipApi | null>(null)

// 触屏点按开启后的护栏窗口：Chromium 触屏点按结束后会把合成 hover 归还原位，
// 在触发器上补发 mouseout/mouseleave，若不否决会在开启后 ~20ms 内被当悬停离开关掉
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
        // 消费即清空：键盘 Enter/Space 合成的 click 无前置 pointerdown，不得复用上次判定
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
          // 鼠标/触控笔点击触发器=关闭，沿用 base-ui closeOnClick 原语义
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
              // cancel 后 store 不落关闭状态，气泡保持打开
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
  // closeOnClick 固定 false：同一次触屏点按若保持 base-ui 默认 true，会被
  // useDismiss 的 referencePress 在 pointerdown 先关、我们的 click 再开，永远关不掉
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
