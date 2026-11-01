import { create } from "zustand";

export interface DialogOptions {
  title?: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface Dialog extends DialogOptions {
  id: number;
  kind: "alert" | "confirm";
  message: string;
  resolve: (ok: boolean) => void;
}

interface DialogState {
  queue: Dialog[];
}

export const useDialogs = create<DialogState>(() => ({ queue: [] }));

let nextId = 1;

function push(kind: Dialog["kind"], message: string, options: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const id = nextId++;
    const dialog: Dialog = {
      ...options,
      id,
      kind,
      message,
      resolve: (ok) => {
        useDialogs.setState((s) => ({ queue: s.queue.filter((d) => d.id !== id) }));
        resolve(ok);
      },
    };
    useDialogs.setState((s) => ({ queue: [...s.queue, dialog] }));
  });
}

export async function showAlert(message: string, options: DialogOptions = {}): Promise<void> {
  await push("alert", message, options);
}

export function showConfirm(message: string, options: DialogOptions = {}): Promise<boolean> {
  return push("confirm", message, options);
}

export function isDialogOpen(): boolean {
  return useDialogs.getState().queue.length > 0;
}
