export interface PlannerPromptContext {
  date: string; // YYYY-MM-DD
  dayName: string; // e.g. "Monday"
  habits: Array<{ id: string; name: string; emoji: string; color: string }>;
  recentWorkouts?: Array<{ name: string; type?: string }>;
  nutritionGoal?: { calories?: number; protein?: number };
  userGoal?: string; // "cut", "bulk", "maintain", etc.
  notes?: string; // custom instructions from the user (e.g. "Meeting at 2pm, rest day today")
}

export const PLANNER_SYSTEM_INSTRUCTION = `You are FitTracker AI Architect, a world-class elite productivity and fitness performance strategist.
Your task is to design a realistic, high-leverage, disciplined, and healthy 24-hour day schedule for an athlete/professional.

Rules:
1. Generate structured time blocks spanning the day from early morning (05:00 onwards) until night wind-down/sleep (up to 00:00).
2. Times must be strictly "HH:mm" in 24-hour format (e.g. "07:00", "13:30", "18:00").
3. Ensure chronological order without impossible overlaps.
4. Integrate the user's active habits strategically throughout the day. When an event corresponds directly to one of the user's provided habits, include the exact habit id in 'linkedHabitIds'.
5. Categorize each event into one of: 'workout', 'nutrition', 'habit', 'recovery', 'focus', 'other'.
   - 'workout': Training, gym sessions, cardio, runs. (Color: #10b981)
   - 'nutrition': Meals, snacks, hydration checks, meal prep. (Color: #f59e0b)
   - 'habit': Discrete habits like journaling, cold plunge, reading, supplements. (Color: #8b5cf6)
   - 'recovery': Mobility, stretching, sauna, breathwork, sleep prep. (Color: #14b8a6)
   - 'focus': Deep work, learning, study, tasks. (Color: #3b82f6)
   - 'other': Commute, personal care, errands. (Color: #71717a)
6. Write crisp, motivating, actionable titles and 1-line descriptions.
7. Return strictly a JSON object matching the requested schema. No markdown formatting, no code fences.`;

export function buildPlannerUserPrompt(context: PlannerPromptContext): string {
  return `Generate an optimal day plan for ${context.dayName}, ${context.date}.

User Profile & Context:
- Target Date: ${context.date} (${context.dayName})
- Goal: ${context.userGoal || "Peak fitness, discipline, and high energy"}
${context.nutritionGoal?.calories ? `- Nutrition Target: ${context.nutritionGoal.calories} kcal (${context.nutritionGoal.protein || 0}g protein)` : ""}
- Active Habits Available:
${
  context.habits.length > 0
    ? context.habits.map((h) => `  * [ID: "${h.id}"] ${h.emoji} ${h.name}`).join("\n")
    : "  (None configured yet)"
}
${
  context.recentWorkouts && context.recentWorkouts.length > 0
    ? `- Recent Workouts: ${context.recentWorkouts.map((w) => w.name).join(", ")}`
    : ""
}
${context.notes ? `- User Special Focus / Instructions: "${context.notes}"` : ""}

Design a complete, motivating day plan with 6-10 high-impact events spanning the day. Link relevant habit IDs wherever applicable.`;
}
