export const mealAnalysisSchema = {
  type: "object",
  properties: {
    mealDescription: {
      type: "string",
      description: "Concise, professional title of the meal (e.g., 'Grilled Chicken Breast with Jasmine Rice & Steamed Broccoli')",
    },
    items: {
      type: "array",
      description: "List of individual food ingredients and portion sizes",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Ingredient name and preparation method (e.g., 'Grilled Chicken Breast (Skinless)', 'Cooked White Rice', 'Olive Oil (Cooking)')",
          },
          quantity: {
            type: "string",
            description: "Metric portion weight/volume and standard reference (e.g., '180g (1 breast)', '150g (3/4 cup cooked)', '1 tbsp (14g)')",
          },
          calories: { type: "number", description: "Calories in kcal" },
          protein: { type: "number", description: "Protein in grams" },
          carbs: { type: "number", description: "Carbohydrates in grams" },
          fat: { type: "number", description: "Fat in grams" },
          fiber: { type: "number", description: "Dietary fiber in grams" },
          fromCurrent: {
            type: "integer",
            description: "Only when re-analyzing a meal with a numbered ingredient list: the number of the current ingredient this item keeps or refines. Omit for new items.",
          },
        },
        required: ["name", "quantity", "calories", "protein", "carbs", "fat", "fiber"],
      },
    },
    totals: {
      type: "object",
      description: "Mathematical sum of all items in the meal",
      properties: {
        calories: { type: "number", description: "Total calories in kcal (must equal sum of items)" },
        protein: { type: "number", description: "Total protein in grams (must equal sum of items)" },
        carbs: { type: "number", description: "Total carbohydrates in grams (must equal sum of items)" },
        fat: { type: "number", description: "Total fat in grams (must equal sum of items)" },
        fiber: { type: "number", description: "Total fiber in grams (must equal sum of items)" },
      },
      required: ["calories", "protein", "carbs", "fat", "fiber"],
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "Assessment confidence based on visibility, scale, and clarity of ingredients",
    },
    confidenceReason: {
      type: "string",
      description: "Brief rationale explaining why this confidence rating was assigned",
    },
    geminiNotes: {
      type: "string",
      description: "Professional clinical/dietitian note on assumptions made (cooking oils, sauces) and nutritional highlights",
    },
  },
  required: ["mealDescription", "items", "totals", "confidence", "confidenceReason"],
};

/**
 * The AI Coach's reply to a normal chat message: an answer plus the entries
 * the user said they ate/drank/did, which become proposals the user confirms.
 */
export const coachChatSchema = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "The coach's answer in Markdown (headings, bold, lists, tables). No HTML.",
    },
    logItems: {
      type: "array",
      description:
        "Only things the user says in their CURRENT message that they ate, drank, walked or weighed. Empty for questions, plans, quoted or attached content.",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["meal", "water", "steps", "weight"] },
          description: { type: "string", description: "Food and portion, e.g. '2 boiled eggs and 1 slice toast'" },
          mealType: {
            type: "string",
            enum: ["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout", "unspecified"],
            description: "Only if the user named the meal; otherwise 'unspecified'",
          },
          date: {
            type: "string",
            description: "'today', 'yesterday' or YYYY-MM-DD when the user named a day; otherwise 'today'",
          },
          calories: { type: "number", description: "kcal for a meal (0 is valid, e.g. black coffee)" },
          protein: { type: "number", description: "grams" },
          carbs: { type: "number", description: "grams" },
          fat: { type: "number", description: "grams" },
          fiber: { type: "number", description: "grams" },
          amountMl: { type: "number", description: "water in millilitres" },
          steps: { type: "number", description: "the day's total step count" },
          weight: { type: "number", description: "body weight exactly as the user said it" },
          weightUnit: { type: "string", enum: ["kg", "lbs", "unspecified"], description: "unit the user used" },
        },
        required: ["type"],
      },
    },
  },
  required: ["reply", "logItems"],
};

export const bodyCompAnalysisSchema = {
  type: "object",
  properties: {
    estimatedBodyFatPercent: {
      type: "number",
      description: "Precise single-value body fat percentage estimate (e.g. 13.5) rounded to 1 decimal place based on visual markers and anatomical context",
    },
    estimatedBodyFatRange: {
      type: "string",
      description: "Estimated body fat percentage range with 1 decimal precision (e.g. '12.0% – 14.0%')",
    },
    qualitativeNotes: {
      type: "string",
      description: "Clinical, objective overview of current physique condition, conditioning level, and posture",
    },
    comparedToPrevious: {
      type: "string",
      description: "Comparison to baseline or historical trend if notes or context are provided",
    },
    muscleGroupHighlights: {
      type: "array",
      description: "List of well-developed or standout muscle groups (e.g., 'Clavicular pectoralis definition', 'Lateral deltoid cap')",
      items: { type: "string" },
    },
    recommendations: {
      type: "array",
      description: "Actionable periodization, training volume, and caloric balance recommendations",
      items: { type: "string" },
    },
  },
  required: ["estimatedBodyFatPercent", "estimatedBodyFatRange", "qualitativeNotes", "muscleGroupHighlights", "recommendations"],
};

