import { useEffect, useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDialogs } from "../state/dialogs";

/**
 * Renders the oldest pending alert or confirm as a shadcn AlertDialog.
 * Replaces window.alert and window.confirm, which block the page, cannot be
 * themed and are suppressed outright by some embedded browsers. Radix owns
 * focus trapping and Escape (which cancels), and stacks correctly above the
 * bundle modal.
 */
export function DialogHost() {
  const dialog = useDialogs((s) => s.queue[0]);
  const isConfirm = dialog?.kind === "confirm";
  const actionRef = useRef<HTMLButtonElement>(null);

  // An app dialog is always the top layer, so it claims Escape first, in the
  // capture phase on window. Radix only learns a new layer is on top after a
  // re-render; a key pressed in that gap would otherwise close the bundle
  // modal underneath instead.
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dialog.resolve(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [dialog]);

  return (
    <AlertDialog
      open={!!dialog}
      onOpenChange={(open) => {
        if (!open) dialog?.resolve(false);
      }}
    >
      {dialog && (
        <AlertDialogContent
          key={dialog.id}
          data-testid="app-dialog"
          // Radix focuses Cancel, which is the safe default for a confirm. An
          // alert has no Cancel, so focus its OK instead of leaving focus
          // behind in whatever opened it.
          onOpenAutoFocus={(e) => {
            if (isConfirm) return;
            e.preventDefault();
            actionRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog.title ?? (isConfirm ? "Are you sure?" : "Notice")}
            </AlertDialogTitle>
            <AlertDialogDescription>{dialog.message}</AlertDialogDescription>
          </AlertDialogHeader>
          {dialog.details && dialog.details.length > 0 && (
            <ol className="dialog-details mt-2.5 list-decimal pl-5 text-[0.8rem] leading-[1.4] [&>li+li]:mt-1">
              {dialog.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          )}
          <AlertDialogFooter>
            {isConfirm && (
              <AlertDialogCancel onClick={() => dialog.resolve(false)}>
                {dialog.cancelLabel ?? "Cancel"}
              </AlertDialogCancel>
            )}
            <AlertDialogAction
              ref={actionRef}
              variant={dialog.danger ? "dialog-danger" : "dialog-primary"}
              onClick={() => dialog.resolve(true)}
            >
              {dialog.confirmLabel ?? "OK"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
