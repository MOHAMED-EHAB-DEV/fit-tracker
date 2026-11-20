declare module "@emoji-mart/data" {
  const data: Record<string, unknown>;
  export default data;
}

declare module "@emoji-mart/react" {
  import type { ComponentType } from "react";

  /** The props this app passes to the picker (see the emoji-mart docs for the rest). */
  export interface EmojiPickerProps {
    data?: unknown;
    onEmojiSelect?: (emoji: { native?: string; id?: string; name?: string }) => void;
    theme?: "auto" | "light" | "dark";
    [option: string]: unknown;
  }

  const Picker: ComponentType<EmojiPickerProps>;
  export default Picker;
}
