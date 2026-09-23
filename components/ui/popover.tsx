"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

function PopoverTrigger({
  className,
  ...props
}: PopoverPrimitive.Trigger.Props) {
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      className={cn("cursor-pointer outline-none", className)}
      {...props}
    />
  )
}

function PopoverContent({
  className,
  side = "bottom",
  align = "end",
  sideOffset = 6,
  children,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, "side" | "align" | "sideOffset">) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "min-w-56 p-1 text-sm",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

/** 遮罩 + 居中弹出卡形态（demo 参照：齿轮设置卡为全屏半透明遮罩 + 居中卡；点遮罩关闭走 onClose） */
function PopoverModalContent({
  className,
  onClose,
  children,
  ...props
}: PopoverPrimitive.Popup.Props & { onClose?: () => void }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Backdrop
        data-slot="popover-modal-backdrop"
        className="fixed inset-0 z-50 bg-black/60"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <PopoverPrimitive.Popup
          data-slot="popover-modal-content"
          className={cn("w-full max-w-sm p-1 text-sm", className)}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </div>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent, PopoverModalContent }
