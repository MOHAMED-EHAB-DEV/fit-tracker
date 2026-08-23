export const mealAnalysisSchema = {
  type: "object",
  properties: {
    mealDescription: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "string" },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          fiber: { type: "number" },
        },
        required: ["name", "calories", "protein", "carbs", "fat"],
      },
    },
    totals: {
      type: "object",
      properties: {
        calories: { type: "number" },
        protein: { type: "number" },
        carbs: { type: "number" },
        fat: { type: "number" },
        fiber: { type: "number" },
      },
      required: ["calories", "protein", "carbs", "fat"],
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    geminiNotes: { type: "string" },
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
