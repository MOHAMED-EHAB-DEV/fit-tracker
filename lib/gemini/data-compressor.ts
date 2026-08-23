import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import Meal from "@/lib/db/models/Meal";
import Workout from "@/lib/db/models/Workout";
import DailyLog from "@/lib/db/models/DailyLog";
import BodyComp from "@/lib/db/models/BodyComp";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { DataContextSummary } from "@/types/gemini";

export interface CompressOptions {
  userId: string;
  dataType: "meals" | "workouts" | "bodycomp" | "progress" | "all" | "today";
  days?: number;
}

export interface CompressedResult {
  textContext: string;
  summary: DataContextSummary;
}

function getPastDateString(daysAgo: number): { startDateStr: string; startDate: Date } {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return { startDateStr: `${yyyy}-${mm}-${dd}`, startDate: d };
}

export async function compressDataForCoach(options: CompressOptions): Promise<CompressedResult> {
  await getDb();
  const { userId, dataType } = options;
  const todayStr = getTodayDateString();

  // 1. Fetch User Profile
  const user: any = await User.findById(userId).lean();
  const fitness = user?.fitnessProfile || {};
  const prefs = user?.preferences || {};
  const computed = user?.computed || {};

  const userGoal = fitness.goal || "maintain";
  const weight = fitness.weightKg ? `${fitness.weightKg}kg` : "N/A";
  const targetCal = fitness.targetCalories || 2000;
  const targetProtein = fitness.targetProteinG || computed.proteinTargetG || 150;
  const tdee = computed.tdee || (targetCal ? targetCal + 300 : 2300);

  const profileHeader = `[USER_PROFILE]
Goal: ${userGoal} | Weight: ${weight} | Target: ${targetCal} kcal, ${targetProtein}g Protein | Est. TDEE: ${tdee} kcal | Step Goal: ${prefs.stepGoal || 8000} | Water Goal: ${prefs.waterGoalMl || 2500}ml
`;

  let days = options.days;
  if (!days || days <= 0) {
    if (dataType === "today") days = 1;
    else if (dataType === "workouts") days = 14;
    else if (dataType === "bodycomp") days = 60;
    else days = 30;
  }

  const { startDateStr, startDate } = getPastDateString(days);
  let recordsCount = 0;
  let lines: string[] = [profileHeader];

  // 2. TODAY SNAPSHOT
  if (dataType === "today") {
    const [todayDaily, todayMeals, todayWorkouts] = await Promise.all([
      DailyLog.findOne({ userId, dateString: todayStr }).lean(),
      Meal.find({ userId, dateString: todayStr }).sort({ loggedAt: 1 }).lean(),
      Workout.find({ userId, date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }).lean(),
    ]);

    recordsCount = (todayMeals?.length || 0) + (todayWorkouts?.length || 0) + (todayDaily ? 1 : 0);

    const calIn = todayDaily?.caloriesIn || (todayMeals || []).reduce((sum: number, m: any) => sum + (m.macros?.calories || 0), 0);
    const prot = todayDaily?.macros?.protein || (todayMeals || []).reduce((sum: number, m: any) => sum + (m.macros?.protein || 0), 0);
    const carbs = todayDaily?.macros?.carbs || (todayMeals || []).reduce((sum: number, m: any) => sum + (m.macros?.carbs || 0), 0);
    const fat = todayDaily?.macros?.fat || (todayMeals || []).reduce((sum: number, m: any) => sum + (m.macros?.fat || 0), 0);
    const water = todayDaily?.waterMl || 0;
    const steps = todayDaily?.steps || 0;

    lines.push(`[TODAY'S LIVE SNAPSHOT (${todayStr})]
Calories In: ${Math.round(calIn)} / ${targetCal} kcal (Remaining: ${Math.max(0, targetCal - Math.round(calIn))} kcal)
Macros: P: ${Math.round(prot)}g / ${targetProtein}g | C: ${Math.round(carbs)}g | F: ${Math.round(fat)}g
Water: ${water} / ${prefs.waterGoalMl || 2500} ml | Steps: ${steps.toLocaleString()} / ${(prefs.stepGoal || 8000).toLocaleString()}`);

    if (todayWorkouts && todayWorkouts.length > 0) {
      lines.push(`Workouts Today (${todayWorkouts.length}): ${todayWorkouts.map((w: any) => `${w.name} (${w.exercises?.length || 0} exercises, vol: ${Math.round(w.totalVolume || 0)}kg)`).join(", ")}`);
    } else {
      lines.push("Workouts Today: None logged yet");
    }

    if (todayMeals && todayMeals.length > 0) {
      lines.push("Meals Logged Today:");
      todayMeals.forEach((m: any, idx: number) => {
        lines.push(` ${idx + 1}. [${m.mealType}] ${m.description} -> ${Math.round(m.macros?.calories || 0)} kcal, P: ${Math.round(m.macros?.protein || 0)}g, C: ${Math.round(m.macros?.carbs || 0)}g, F: ${Math.round(m.macros?.fat || 0)}g`);
      });
    } else {
      lines.push("Meals Logged Today: None yet");
    }
  }

  // 3. MEALS HISTORY (e.g. 30 Days)
  if (dataType === "meals" || dataType === "all" || dataType === "progress") {
    const meals = await Meal.find({
      userId,
      dateString: { $gte: startDateStr, $lte: todayStr },
    })
      .sort({ dateString: 1, loggedAt: 1 })
      .lean();

    recordsCount += meals.length;

    // Group by dateString
    const mealsByDate: Record<string, any[]> = {};
    for (const m of meals) {
      if (!mealsByDate[m.dateString]) mealsByDate[m.dateString] = [];
      mealsByDate[m.dateString].push(m);
    }

    const distinctDays = Object.keys(mealsByDate);
    const activeDaysCount = distinctDays.length;

    let totalCal = 0;
    let totalP = 0;
    let totalC = 0;
    let totalF = 0;
    let daysTargetHit = 0;
    let daysProteinHit = 0;

    distinctDays.forEach((d) => {
      const dayMeals = mealsByDate[d];
      const dayCal = dayMeals.reduce((acc, m) => acc + (m.macros?.calories || 0), 0);
      const dayP = dayMeals.reduce((acc, m) => acc + (m.macros?.protein || 0), 0);
      const dayC = dayMeals.reduce((acc, m) => acc + (m.macros?.carbs || 0), 0);
      const dayF = dayMeals.reduce((acc, m) => acc + (m.macros?.fat || 0), 0);

      totalCal += dayCal;
      totalP += dayP;
      totalC += dayC;
      totalF += dayF;

      if (Math.abs(dayCal - targetCal) <= targetCal * 0.12) daysTargetHit++;
      if (dayP >= targetProtein * 0.9) daysProteinHit++;
    });

    const avgCal = activeDaysCount ? Math.round(totalCal / activeDaysCount) : 0;
    const avgP = activeDaysCount ? Math.round(totalP / activeDaysCount) : 0;
    const avgC = activeDaysCount ? Math.round(totalC / activeDaysCount) : 0;
    const avgF = activeDaysCount ? Math.round(totalF / activeDaysCount) : 0;
    const calAdherencePct = activeDaysCount ? Math.round((daysTargetHit / activeDaysCount) * 100) : 0;
    const pAdherencePct = activeDaysCount ? Math.round((daysProteinHit / activeDaysCount) * 100) : 0;

    lines.push(`\n[NUTRITION & MEALS SUMMARY (${days} DAYS)]
Total Meals Logged: ${meals.length} across ${activeDaysCount}/${days} days
Daily Averages: ${avgCal} kcal (P: ${avgP}g, C: ${avgC}g, F: ${avgF}g)
Calorie Adherence (±12% of ${targetCal} kcal): ${calAdherencePct}% (${daysTargetHit}/${activeDaysCount} days)
Protein Target Adherence (>=${Math.round(targetProtein * 0.9)}g): ${pAdherencePct}% (${daysProteinHit}/${activeDaysCount} days)

[DAILY NUTRITION CHRONOLOGY]`);

    if (distinctDays.length === 0) {
      lines.push("No meals logged in this period.");
    } else {
      distinctDays.forEach((d) => {
        const dayMeals = mealsByDate[d];
        const dayCal = Math.round(dayMeals.reduce((acc, m) => acc + (m.macros?.calories || 0), 0));
        const dayP = Math.round(dayMeals.reduce((acc, m) => acc + (m.macros?.protein || 0), 0));
        const dayC = Math.round(dayMeals.reduce((acc, m) => acc + (m.macros?.carbs || 0), 0));
        const dayF = Math.round(dayMeals.reduce((acc, m) => acc + (m.macros?.fat || 0), 0));

        const mealHighlights = dayMeals
          .slice(0, 3)
          .map((m) => `${m.description?.slice(0, 24) || "Meal"} (${Math.round(m.macros?.calories || 0)}k/${Math.round(m.macros?.protein || 0)}p)`)
          .join(", ");

        lines.push(`${d}: ${dayCal} kcal [P:${dayP}g C:${dayC}g F:${dayF}g] | ${dayMeals.length} meals | ${mealHighlights}`);
      });
    }
  }

  // 4. WORKOUTS (e.g. 14 or 30 Days)
  if (dataType === "workouts" || dataType === "all" || dataType === "progress") {
    const workouts = await Workout.find({
      userId,
      date: { $gte: startDate },
      status: "completed",
    })
      .sort({ date: 1 })
      .lean();

    recordsCount += workouts.length;

    const muscleSets: Record<string, number> = {};
    let totalVol = 0;
    let totalDuration = 0;
    const prsList: string[] = [];

    workouts.forEach((w: any) => {
      totalVol += w.totalVolume || 0;
      totalDuration += w.durationSeconds || 0;
      (w.exercises || []).forEach((ex: any) => {
        const mg = ex.muscleGroup || "Other";
        const completedSets = (ex.sets || []).filter((s: any) => s.completedReps && s.completedReps > 0);
        muscleSets[mg] = (muscleSets[mg] || 0) + completedSets.length;

        (ex.sets || []).forEach((s: any) => {
          if (s.isPR && s.weight && s.completedReps) {
            prsList.push(`${ex.name}: ${s.weight}kg x ${s.completedReps} reps`);
          }
        });
      });
    });

    const avgDurationMin = workouts.length ? Math.round(totalDuration / workouts.length / 60) : 0;
    const muscleVolumeStr = Object.entries(muscleSets)
      .map(([m, s]) => `${m}: ${s} sets`)
      .join(" | ");

    lines.push(`\n[TRAINING & WORKOUT SUMMARY (${days} DAYS)]
Completed Sessions: ${workouts.length} | Total Volume Moved: ${Math.round(totalVol).toLocaleString()} kg | Avg Session: ${avgDurationMin} min
Muscle Group Volume: ${muscleVolumeStr || "None"}
PRs Hit in Window: ${prsList.length ? prsList.slice(-5).join(" • ") : "None"}`);

    lines.push("[WORKOUT LOG SESSIONS]");
    if (workouts.length === 0) {
      lines.push("No completed workouts logged in this period.");
    } else {
      workouts.slice(-10).forEach((w: any) => {
        const dStr = w.date ? new Date(w.date).toISOString().split("T")[0] : "N/A";
        const exSummary = (w.exercises || [])
          .map((ex: any) => {
            const heavySet = (ex.sets || [])
              .filter((s: any) => s.weight && s.completedReps)
              .sort((a: any, b: any) => (b.weight || 0) - (a.weight || 0))[0];
            return heavySet
              ? `${ex.name} (${heavySet.weight}kgx${heavySet.completedReps})`
              : ex.name;
          })
          .slice(0, 4)
          .join(", ");

        lines.push(`${dStr} [${w.name} - ${w.dayOfWeek}]: ${w.exercises?.length || 0} exercises, vol ${Math.round(w.totalVolume || 0)}kg | ${exSummary}`);
      });
    }
  }

  // 5. BODY COMP & PROGRESS (e.g. 30-60 Days)
  if (dataType === "bodycomp" || dataType === "progress" || dataType === "all") {
    const [checkIns, dailyLogs] = await Promise.all([
      BodyComp.find({
        userId,
        checkInDate: { $gte: startDate },
      })
        .sort({ checkInDate: 1 })
        .lean(),
      DailyLog.find({
        userId,
        dateString: { $gte: startDateStr, $lte: todayStr },
      })
        .sort({ dateString: 1 })
        .lean(),
    ]);

    recordsCount += checkIns.length;

    const startWeight = checkIns.length > 0 ? checkIns[0].weight : fitness.weightKg;
    const endWeight = checkIns.length > 0 ? checkIns[checkIns.length - 1].weight : fitness.weightKg;
    const weightDelta = startWeight && endWeight ? Math.round((endWeight - startWeight) * 10) / 10 : 0;
    const weeklyRate = days > 0 ? Math.round((weightDelta / (days / 7)) * 100) / 100 : 0;

    let avgSteps = 0;
    let avgWater = 0;
    if (dailyLogs.length > 0) {
      const sumSteps = dailyLogs.reduce((acc: number, d: any) => acc + (d.steps || 0), 0);
      const sumWater = dailyLogs.reduce((acc: number, d: any) => acc + (d.waterMl || 0), 0);
      avgSteps = Math.round(sumSteps / dailyLogs.length);
      avgWater = Math.round(sumWater / dailyLogs.length);
    }

    lines.push(`\n[BODY COMPOSITION & PROGRESSION (${days} DAYS)]
Weight Trend: ${startWeight || "N/A"}kg -> ${endWeight || "N/A"}kg (Delta: ${weightDelta > 0 ? "+" : ""}${weightDelta}kg, Rate: ${weeklyRate > 0 ? "+" : ""}${weeklyRate} kg/week)
Daily Activity Averages: ${avgSteps.toLocaleString()} steps/day | ${avgWater} ml water/day
Physique Check-ins Logged: ${checkIns.length}`);

    if (checkIns.length > 0) {
      lines.push("[CHECK-IN LOGS]");
      checkIns.slice(-6).forEach((c: any) => {
        const dStr = c.dateString || (c.checkInDate ? new Date(c.checkInDate).toISOString().split("T")[0] : "N/A");
        const bf = c.bodyFatPercent ? ` | BF: ${c.bodyFatPercent}%` : "";
        const note = c.notes ? ` | Note: ${c.notes.slice(0, 30)}` : "";
        lines.push(`${dStr}: ${c.weight || "N/A"}kg${bf}${note}`);
      });
    }
  }

  const textContext = lines.join("\n");
  // Estimate tokens (~3.8 characters per token)
  const tokensEstimated = Math.round(textContext.length / 3.8);

  const badgeLabels: Record<string, string> = {
    meals: `📊 Injected ${days}-Day Nutrition Context (${recordsCount} Meals)`,
    workouts: `🏋️ Injected ${days}-Day Training Context (${recordsCount} Workouts)`,
    bodycomp: `⚖️ Injected ${days}-Day Body Comp Trend`,
    progress: `📈 Injected ${days}-Day Holistic Progress Context`,
    all: `🌐 Injected Complete 360° Fitness History (${days}d)`,
    today: `⚡ Injected Today's Live Snapshot`,
  };

  const summary: DataContextSummary = {
    dataType,
    days,
    recordsCount,
    tokensEstimated,
    badgeLabel: badgeLabels[dataType] || `Injected ${days}d Data Context`,
  };

  return { textContext, summary };
}
