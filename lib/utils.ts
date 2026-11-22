import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge needs to know the custom theme names in app/globals.css,
 * otherwise `rounded-card` would not replace `rounded-xl` and `text-title`
 * would be mistaken for a colour.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["card", "control", "chip"],
      text: ["display", "title", "section"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
