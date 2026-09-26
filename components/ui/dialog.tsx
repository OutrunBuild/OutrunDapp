"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

function DialogTrigger({ className, ...props }: DialogPrimitive.Trigger.Props) {
  return (
    <DialogPrimitive.Trigger
      data-slot="dialog-trigger"
      className={cn("cursor-pointer outline-none", className)}
      {...props}
    />
  )
}

/** 遮罩 + 居中弹窗（Esc/外点关闭、焦点圈回触发器由 base-ui Dialog 内置） */
function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop data-slot="dialog-backdrop" className="fixed inset-0 z-50" />
      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "w-full max-w-sm p-1 text-sm",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Popup>
      </div>
    </DialogPrimitive.Portal>
  )
}

/** 弹窗标题（Popup 的 aria-labelledby 锚点，必须有才过 a11y） */
function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={className} {...props} />
}

/** 关闭钮（自定义触发器用 render；Esc/外点关闭由 Popup 内置） */
function DialogClose({ className, ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" className={className} {...props} />
}

export { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogClose }
