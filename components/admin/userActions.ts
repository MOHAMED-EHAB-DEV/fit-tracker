export type UserAction = "delete" | "ban" | "unban" | "promote" | "demote";

interface ActionCopy {
  title: string;
  message: string;
  confirmLabel: string;
  variant: "danger" | "warning" | "primary";
  done: string;
}

/** Confirmation texts for user actions; they say exactly what will happen. */
export function userActionCopy(action: UserAction, name: string): ActionCopy {
  const who = name || "this user";
  switch (action) {
    case "delete":
      return {
        title: "Delete user",
        message: `Permanently delete ${who}? Their account, workouts, routines, records, meals, daily logs, check-ins and photos, habits, planner events and custom exercises are erased. This cannot be undone.`,
        confirmLabel: "Delete permanently",
        variant: "danger",
        done: `${who} was deleted`,
      };
    case "ban":
      return {
        title: "Ban user",
        message: `Ban ${who}? They are signed out on every device right away and cannot sign in until you unban them. Their data is kept.`,
        confirmLabel: "Ban",
        variant: "danger",
        done: `${who} is banned and signed out everywhere`,
      };
    case "unban":
      return {
        title: "Unban user",
        message: `Let ${who} sign in again?`,
        confirmLabel: "Unban",
        variant: "primary",
        done: `${who} can sign in again`,
      };
    case "promote":
      return {
        title: "Make admin",
        message: `Give ${who} admin rights? They will be able to manage every user, the exercise catalog and nutrition plans.`,
        confirmLabel: "Make admin",
        variant: "primary",
        done: `${who} is now an admin`,
      };
    case "demote":
      return {
        title: "Remove admin rights",
        message: `Remove admin rights from ${who}? They keep their account as a regular user and are signed out so the change applies immediately.`,
        confirmLabel: "Remove admin rights",
        variant: "warning",
        done: `${who} is no longer an admin`,
      };
  }
}
