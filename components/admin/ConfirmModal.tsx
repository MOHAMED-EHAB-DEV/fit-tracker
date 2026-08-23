"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  const variantConfig = {
    danger: {
      bg: "bg-red-500/10 border-red-500/20",
      text: "text-red-400",
      btnVariant: "danger" as const,
      btnClass: "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/25",
    },
    warning: {
      bg: "bg-amber-500/10 border-amber-500/20",
      text: "text-amber-400",
      btnVariant: "solid" as const,
      btnClass: "bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold shadow-lg shadow-amber-500/25",
    },
    primary: {
      bg: "bg-violet-500/10 border-violet-500/20",
      text: "text-violet-400",
      btnVariant: "solid" as const,
      btnClass: "bg-violet-600 hover:bg-violet-500 text-white font-bold shadow-lg shadow-violet-500/25",
    },
  };

  const current = variantConfig[confirmVariant] || variantConfig.danger;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={current.btnVariant}
            size="md"
            onClick={onConfirm}
            isLoading={isLoading}
            className={current.btnClass}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-4 pt-1">
        <div
          className={cn(
            "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border",
            current.bg
          )}
        >
          <AlertTriangle className={cn("w-5 h-5", current.text)} />
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed pt-1.5">{message}</p>
      </div>
    </Modal>
  );
}

export default ConfirmModal;

