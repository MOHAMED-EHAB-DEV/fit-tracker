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
        },
        required: ["name", "quantity", "calories", "protein", "carbs", "fat"],
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
      required: ["calories", "protein", "carbs", "fat"],
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "Assessment confidence based on visibility, scale, and clarity of ingredients",
    },
    geminiNotes: {
      type: "string",
      description: "Professional clinical/dietitian note on assumptions made (cooking oils, sauces) and nutritional highlights",
    },
  },
  required: ["mealDescription", "items", "totals", "confidence"],
};

export const multiLogSchema = {
  type: "object",
  properties: {
    logItems: {
      type: "array",
      description: "Array of parsed fitness/nutrition logging entries extracted from natural language",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["meal", "water", "steps", "weight", "note"],
            description: "Activity classification domain",
          },
          description: {
            type: "string",
            description: "Clear, descriptive title including quantity/portion (e.g., 'Oatmeal with Whey Protein & Berries', 'Morning hydration')",
          },
          macros: {
            type: "object",
            description: "Macronutrient breakdown required when type is 'meal'",
            properties: {
              calories: { type: "number", description: "Estimated total calories in kcal" },
              protein: { type: "number", description: "Estimated protein in grams" },
              carbs: { type: "number", description: "Estimated carbohydrates in grams" },
              fat: { type: "number", description: "Estimated fat in grams" },
            },
          },
          amountMl: {
            type: "number",
            description: "Water/liquid volume in milliliters (required when type is 'water')",
          },
          count: {
            type: "number",
            description: "Total step count (required when type is 'steps')",
          },
          weightKg: {
            type: "number",
            description: "Body weight in kilograms rounded to 1 decimal place (required when type is 'weight')",
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Confidence in parsing certainty",
          },
        },
        required: ["type", "description", "confidence"],
      },
    },
    chatReply: {
      type: "string",
      description: "Friendly, motivating confirmation response summarizing logged entries or answering coaching questions",
    },
    parseNotes: {
      type: "string",
      description: "Internal parser diagnostics on assumptions or conversions made",
    },
  },
  required: ["logItems", "chatReply"],
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

