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
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["meal", "water", "steps", "weight", "note"],
          },
          description: { type: "string" },
          macros: {
            type: "object",
            properties: {
              calories: { type: "number" },
              protein: { type: "number" },
              carbs: { type: "number" },
              fat: { type: "number" },
            },
          },
          amountMl: { type: "number" },
          count: { type: "number" },
          weightKg: { type: "number" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["type", "description", "confidence"],
      },
    },
    chatReply: { type: "string" },
    parseNotes: { type: "string" },
  },
  required: ["logItems", "chatReply"],
};

export const bodyCompAnalysisSchema = {
  type: "object",
  properties: {
    qualitativeNotes: { type: "string" },
    estimatedBodyFatRange: { type: "string" },
    comparedToPrevious: { type: "string" },
    muscleGroupHighlights: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
  },
  required: ["qualitativeNotes", "estimatedBodyFatRange"],
};
