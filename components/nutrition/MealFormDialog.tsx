"use client";

import React, { useState } from "react";
import { Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { MealForm, type MealFormProps } from "@/components/nutrition/MealForm";
import { isDraftDirty, type MealDraft } from "@/lib/nutrition/draft";

interface MealFormDialogProps extends Omit<MealFormProps, "disabled"> {
  isOpen: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Draft the dialog opened with; closing with changes asks before discarding. */
  initialDraft: MealDraft;
  submitLabel: string;
  isSaving: boolean;
  /** Another operation (e.g. AI) is running: inputs and save are locked. */
  isBusy?: boolean;
  /** Treat the dialog as having unsaved work even without edits (e.g. an unsaved AI result). */
  forceDirty?: boolean;
  discardLabel?: string;
  onSubmit: () => void;
  onClose: () => void;
}

/** A modal around MealForm that never throws away edits without asking. */
export function MealFormDialog({
  isOpen,
  title,
  description,
  initialDraft,
  submitLabel,
  isSaving,
  isBusy,
  forceDirty,
  discardLabel = "Discard changes",
  onSubmit,
  onClose,
  ...formProps
}: MealFormDialogProps) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const dirty = Boolean(forceDirty) || isDraftDirty(initialDraft, formProps.draft);
  const locked = isSaving || Boolean(isBusy);

  const requestClose = () => {
    if (isSaving) return;
    if (dirty && !confirmingDiscard) {
      setConfirmingDiscard(true);
      return;
    }
    setConfirmingDiscard(false);
    onClose();
  };

  const footer = confirmingDiscard ? (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full" role="alertdialog" aria-label="Unsaved changes">
      <span className="text-sm text-amber-300 font-medium">You have unsaved changes.</span>
      <div className="flex items-center gap-2 justify-end">
        <Button type="button" variant="bordered" size="md" onClick={() => setConfirmingDiscard(false)} autoFocus>
          Keep editing
        </Button>
        <Button
          type="button"
          variant="danger"
          size="md"
          onClick={() => {
            setConfirmingDiscard(false);
            onClose();
          }}
        >
          {discardLabel}
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-end gap-3 w-full">
      <Button type="button" variant="bordered" size="md" onClick={requestClose} disabled={isSaving}>
        Cancel
      </Button>
      <Button
        type="submit"
        form={`${formProps.idPrefix}-form`}
        variant="solid"
        size="md"
        isLoading={isSaving}
        disabled={locked}
        startContent={isSaving ? undefined : <Check className="w-4 h-4" aria-hidden="true" />}
      >
        {submitLabel}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      size="2xl"
      title={title}
      description={description}
      closeOnBackdropClick={!dirty}
      footer={footer}
    >
      <form
        id={`${formProps.idPrefix}-form`}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!locked) onSubmit();
        }}
      >
        <MealForm {...formProps} disabled={locked} />
      </form>
    </Modal>
  );
}

export default MealFormDialog;
