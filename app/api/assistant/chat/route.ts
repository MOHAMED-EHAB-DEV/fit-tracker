import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Meal from "@/lib/db/models/Meal";
import DailyLog from "@/lib/db/models/DailyLog";
import User from "@/lib/db/models/User";
import BodyComp from "@/lib/db/models/BodyComp";
import genAI, { flashModel, resolveGeminiModel } from "@/lib/gemini/client";
import { multiLogSchema } from "@/lib/gemini/schemas";
import { MULTI_LOG_SYSTEM_PROMPT, AI_COACH_SYSTEM_PROMPT } from "@/lib/gemini/prompts";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { MultiLogResponse } from "@/types/gemini";
import { parseCoachCommand } from "@/lib/gemini/command-parser";
import { compressDataForCoach } from "@/lib/gemini/data-compressor";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { message, model: requestedModel, mode } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    await getDb();
    const todayStr = getTodayDateString();

    // 1. Check for Slash Commands or explicit Data Injection
    const parsedCmd = parseCoachCommand(message, requestedModel);

    // If slash command or coach mode or data injection was requested:
    if (parsedCmd.isCommand || mode === "coach" || parsedCmd.dataType) {
      const targetModel = resolveGeminiModel(parsedCmd.modelOverride || requestedModel);

      // Fetch and compress relevant user data
      const { textContext, summary } = await compressDataForCoach({
        userId: session.userId,
        dataType: parsedCmd.dataType || "all",
        days: parsedCmd.days,
      });

      let reply = "I analyzed your data!";

      if (process.env.GEMINI_API_KEY) {
        try {
          const contents = [
            "=== USER COMPRESSED FITNESS DATA CONTEXT ===",
            textContext,
            "=== END DATA CONTEXT ===",
            "",
            `User Query / Intent: "${parsedCmd.userPrompt}"`,
            parsedCmd.coachingFocus ? `Special Coaching Focus: ${parsedCmd.coachingFocus.replace(/_/g, " ")}` : "",
            `Current Date Reference: ${todayStr}`,
            "",
            "Coaching Directives:",
            "- Directly reference the user's actual averages, targets, volume trends, and weight change slopes from the context block.",
            "- Apply exercise physiology and sports nutrition principles (energy balance, volume landmarks MEV/MAV/MRV, protein threshold).",
            "- Use bold formatting for all numerical metrics and conclude with a concrete ⚡ Action Plan.",
          ].filter(Boolean).join("\n");

          const response = await genAI.models.generateContent({
            model: targetModel,
            contents,
            config: {
              systemInstruction: AI_COACH_SYSTEM_PROMPT,
              maxOutputTokens: 3000,
            },
          });

          if (response.text) {
            reply = response.text.trim();
          }
        } catch (geminiErr: any) {
          console.error("Gemini Coach Command Error:", geminiErr);
          reply = `Sorry, I encountered an issue analyzing your data with ${targetModel}. Please try again.`;
        }
      }

      return NextResponse.json({
        success: true,
        chatReply: reply,
        modelUsed: targetModel,
        commandDetected: parsedCmd.commandName || null,
        dataContext: summary,
      });
    }

    // 2. Default: Multi-item logging & conversational query
    let parsedResult: MultiLogResponse = {
      logItems: [],
      chatReply: "I received your message!",
      parseNotes: "",
    };

    const targetModel = resolveGeminiModel(requestedModel);

    if (process.env.GEMINI_API_KEY) {
      try {
        const promptText = [
          `User Natural Language Input: "${message.trim()}"`,
          `Today's Reference Date: ${todayStr}`,
          "",
          "Parsing & Coaching Instructions:",
          "1. If logging activities, extract all distinct items (meals, water, steps, weight, notes) into structured 'logItems'.",
          "2. For meals: estimate realistic portions and scientific macronutrients using USDA references (Calories ≈ P*4 + C*4 + F*9).",
          "3. For water: convert amounts accurately to milliliters 'amountMl' (1 glass = 250ml, 1 bottle = 500ml, 1L = 1000ml).",
          "4. For weight: convert to kilograms 'weightKg' with 1 decimal precision.",
          "5. For step counts: extract total daily count 'count'.",
          "6. If the input is purely a fitness or coaching question, leave 'logItems' empty and provide an expert coach answer in 'chatReply'.",
          "7. In 'chatReply', confirm exact numbers logged with an upbeat, professional tone or deliver sharp coaching advice.",
        ].join("\n");

        const response = await genAI.models.generateContent({
          model: targetModel,
          contents: promptText,
          config: {
            systemInstruction: MULTI_LOG_SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema: multiLogSchema as any,
            maxOutputTokens: 2048,
          },
        });

        const text = response.text;
        if (text) {
          const cleaned = text.replace(/```json\s*|```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          if (parsed && typeof parsed === "object") {
            parsedResult = {
              logItems: Array.isArray(parsed.logItems)
                ? parsed.logItems.map((item: any) => ({
                    type: item.type,
                    description: item.description || "Activity",
                    macros: item.macros
                      ? {
                          calories: Math.round(Number(item.macros.calories) || 0),
                          protein: Number((Number(item.macros.protein) || 0).toFixed(1)),
                          carbs: Number((Number(item.macros.carbs) || 0).toFixed(1)),
                          fat: Number((Number(item.macros.fat) || 0).toFixed(1)),
                        }
                      : undefined,
                    amountMl: item.amountMl ? Math.round(Number(item.amountMl)) : undefined,
                    count: item.count ? Math.round(Number(item.count)) : undefined,
                    weightKg: item.weightKg ? Number((Number(item.weightKg) || 0).toFixed(1)) : undefined,
                    confidence: item.confidence || "medium",
                  }))
                : [],
              chatReply: parsed.chatReply || "Logged your request.",
              parseNotes: parsed.parseNotes || "",
            };
          }
        }
      } catch (geminiErr) {
        console.error("Gemini multi-log error:", geminiErr);
        parsedResult.chatReply = "Saved your request locally.";
      }
    }

    // Orchestrate batch writes for parsed items if any
    const writePromises: Promise<any>[] = [];
    let mealsCreated = 0;
    let waterAdded = 0;
    let stepsUpdated = 0;

    for (const item of parsedResult.logItems || []) {
      if (item.type === "meal") {
        const cal = item.macros?.calories || 200;
        const p = item.macros?.protein || 10;
        const c = item.macros?.carbs || 25;
        const f = item.macros?.fat || 5;

        writePromises.push(
          Meal.create({
            userId: session.userId,
            loggedAt: new Date(),
            dateString: todayStr,
            mealType: "snack",
            description: item.description,
            imageSource: "text_only",
            macros: { calories: cal, protein: p, carbs: c, fat: f, fiber: 0 },
            isManualOverride: false,
          }),
          DailyLog.findOneAndUpdate(
            { userId: session.userId, dateString: todayStr },
            {
              $inc: {
                caloriesIn: cal,
                "macros.protein": p,
                "macros.carbs": c,
                "macros.fat": f,
              },
            },
            { upsert: true }
          )
        );
        mealsCreated++;
      } else if (item.type === "water" && item.amountMl) {
        const amount = Number(item.amountMl);
        writePromises.push(
          DailyLog.findOneAndUpdate(
            { userId: session.userId, dateString: todayStr },
            {
              $inc: { waterMl: amount },
              $push: { waterEntries: { amount, loggedAt: new Date() } },
            },
            { upsert: true }
          )
        );
        waterAdded += amount;
      } else if (item.type === "steps" && item.count) {
        const count = Number(item.count);
        writePromises.push(
          DailyLog.findOneAndUpdate(
            { userId: session.userId, dateString: todayStr },
            { $max: { steps: count } },
            { upsert: true }
          )
        );
        stepsUpdated = Math.max(stepsUpdated, count);
      } else if (item.type === "weight" && item.weightKg) {
        const weight = Number(item.weightKg);
        writePromises.push(
          User.updateOne(
            { _id: session.userId },
            { $set: { "fitnessProfile.weightKg": weight } }
          ),
          BodyComp.create({
            userId: session.userId,
            checkInDate: new Date(),
            dateString: todayStr,
            weight,
            photos: [],
            notes: item.description,
          })
        );
      }
    }

    if (writePromises.length > 0) {
      await Promise.all(writePromises);
    }

    return NextResponse.json({
      success: true,
      chatReply: parsedResult.chatReply,
      logItems: parsedResult.logItems,
      modelUsed: targetModel,
      writeResults: { mealsCreated, waterAdded, stepsUpdated },
    });
  } catch (err: any) {
    console.error("Assistant chat route error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
