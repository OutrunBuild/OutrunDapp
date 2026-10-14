"use client"

// Bottom action sheet primitive (mobile asset rows carry no inline buttons, so row actions open
// this sheet instead): hand-inlined copy of the shadcn sheet, consistent with the existing
// ui/*.tsx files. Reuses the full base-ui Dialog pipeline
// (Esc/outside-click close, focus trap, focus restore, aria binding); only the anchoring changes,
// from centered to bottom slide-up; the backdrop slot reuses the dialog-backdrop skin. Product
// styling is carried by the caller's classes (.pf-asset-sheet*); this layer provides only
// anchoring and safe-area handling.
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "@/lib/utils"

const Sheet = DialogPrimitive.Root

function SheetTrigger({ className, ...props }: DialogPrimitive.Trigger.Props) {
  return (
    <DialogPrimitive.Trigger
      data-slot="sheet-trigger"
      className={cn("cursor-pointer outline-none", className)}
      {...props}
    />
  )
}

/** Bottom anchored: backdrop + bottom-edge safe area; enter/exit animation enum props (see caller classes) */
function SheetContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop data-slot="dialog-backdrop" className="fixed inset-0 z-50" />
      <div className="pf-sheet-anchor fixed inset-0 z-50 flex items-end justify-center">
        <DialogPrimitive.Popup
          data-slot="sheet-content"
          className={cn(
            "w-full p-3 pb-[calc(var(--space-3) + env(safe-area-inset-bottom))] text-sm",
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

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title data-slot="sheet-title" className={className} {...props} />
}

function SheetClose({ className, ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="sheet-close" className={className} {...props} />
}

export { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetClose }
