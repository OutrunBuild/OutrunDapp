"use client"

// 底部动作面板原语（2026-10-05 决议 018 补充：资产行移动端去按钮化）：shadcn 清单内
// 允许加装的 sheet 的手工内联版（AGENTS 纪律：dlx 组件按现有 ui/*.tsx 内联）。
// 复用 base-ui Dialog 全套管线（Esc/外点关闭、焦点圈闭、焦点还原、aria 绑定），
// 仅锚定从居中改底部滑上；遮罩槽位复用 dialog-backdrop 皮肤。产品样式由调用方
// 类（.pf-asset-sheet*）承担，本层只给锚定与安全区。
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

/** 底部锚定：遮罩 + 底缘安全区；进出场动画枚举属性（见调用方类） */
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
