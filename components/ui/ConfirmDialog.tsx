"use client";

import React from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  /** Say exactly what will happen, in the user's terms. */
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  isWorking?: boolean;
  /** Shown inside the dialog when the action failed. */
  error?: string | null;
  /** Extra detail under the message (e.g. what still uses the item). */
  children?: React.ReactNode;
}

/**
 * The one confirmation, for irreversible actions only (reversible deletes are
 * instant with an Undo toast instead).
 */
export function ConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  isWorking = false,
  error,
  children,
}: ConfirmDialogProps) {
  return (
    <Sheet
      isOpen={isOpen}
      onClose={isWorking ? () => undefined : onCancel}
      title={title}
      size="sm"
      showCloseButton={false}
      closeOnBackdropClick={!isWorking}
    >
      <div className="space-y-4">
        <div className="text-sm leading-5 text-ink-2">{message}</div>
        {children}
        {error && (
          <p role="alert" className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="lg" onClick={onCancel} disabled={isWorking} data-autofocus>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            size="lg"
            onClick={() => void onConfirm()}
            isLoading={isWorking}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

export default ConfirmDialog;
