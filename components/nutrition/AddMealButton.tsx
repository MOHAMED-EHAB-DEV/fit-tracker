"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AddMealSheet, type AddMealMode } from "@/components/nutrition/AddMealSheet";

interface AddMealButtonProps {
  /** The day being viewed; the new meal defaults to it. */
  dateString: string;
  /** Manual entry (default) or a photo scan. */
  mode?: AddMealMode;
  className?: string;
  /** A custom trigger instead of the default button; call `open` to show the sheet. */
  children?: (open: () => void) => ReactNode;
}

/** "Log meal": opens the meal sheet for any day up to today. */
export function AddMealButton({ dateString, mode = "manual", className, children }: AddMealButtonProps) {
  const [open, setOpen] = useState(false);
  const show = () => setOpen(true);

  return (
    <>
      {children ? (
        children(show)
      ) : (
        <Button className={className} startContent={<Plus className="h-4 w-4" />} onClick={show}>
          Log meal
        </Button>
      )}
      <AddMealSheet isOpen={open} onClose={() => setOpen(false)} dateString={dateString} initialMode={mode} />
    </>
  );
}

export default AddMealButton;
