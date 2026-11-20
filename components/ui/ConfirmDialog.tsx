"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
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
}

/** The one confirmation dialog used for irreversible actions. */
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
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isWorking ? () => undefined : onCancel}
      title={title}
      size="sm"
      showCloseButton={false}
      closeOnBackdropClick={!isWorking}
      footer={
        <>
          <Button variant="bordered" onClick={onCancel} disabled={isWorking} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "danger" : "solid"} onClick={() => void onConfirm()} isLoading={isWorking}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-zinc-300">
        <div>{message}</div>
        {error && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
