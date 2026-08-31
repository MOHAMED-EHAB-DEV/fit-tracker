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
import { MultiLogResponse, ReferencedMessage, CoachAttachment } from "@/types/gemini";
import { parseCoachCommand } from "@/lib/gemini/command-parser";
import { compressDataForCoach } from "@/lib/gemini/data-compressor";
import {
  validateAttachment,
  MAX_ATTACHMENTS_COUNT,
  MAX_TOTAL_UPLOAD_BYTES,
} from "@/lib/security/file-validator";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      message,
      model: requestedModel,
      mode,
      referencedMessages,
      attachments,
    } = body as {
      message: string;
      model?: string;
      mode?: "coach" | "log" | "auto";
      referencedMessages?: ReferencedMessage[];
      attachments?: CoachAttachment[];
    };

    if ((!message || typeof message !== "string") && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { success: false, error: "Message or attachment is required" },
        { status: 400 }
      );
    }

    const safeMessage = typeof message === "string" ? message : "";

    // 1. Validate Attachments with Security Checks
    const validatedInlineParts: { inlineData: { mimeType: string; data: string } }[] = [];
    const textFileBlocks: string[] = [];

    if (Array.isArray(attachments) && attachments.length > 0) {
      if (attachments.length > MAX_ATTACHMENTS_COUNT) {
        return NextResponse.json(
          {
            success: false,
            error: `Maximum ${MAX_ATTACHMENTS_COUNT} attachments allowed per message.`,
          },
          { status: 400 }
        );
      }

      let totalBytes = 0;

      for (const att of attachments) {
        totalBytes += att.size || (att.base64?.length ? Math.round((att.base64.length * 3) / 4) : 0);
        if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
          return NextResponse.json(
            {
              success: false,
              error: `Total attachment size exceeds maximum allowed 25MB limit.`,
            },
            { status: 400 }
          );
        }

        const validation = validateAttachment(att);
        if (!validation.valid) {
          return NextResponse.json(
            {
              success: false,
              error: `Security Validation Error for '${att.name}': ${validation.error}`,
            },
            { status: 400 }
          );
        }

        if (validation.isTextBased && validation.sanitizedBuffer) {
          // Decode safe text and inject as text block
          const textContent = validation.sanitizedBuffer.toString("utf-8");
          textFileBlocks.push(
            [
              `=== ATTACHED DATA FILE: "${att.name}" (${validation.detectedMimeType}) ===`,
              textContent.slice(0, 50000), // Protect against excessive prompt tokens
              `=== END ATTACHED DATA FILE: "${att.name}" ===`,
            ].join("\n")
          );
        } else if (validation.cleanBase64 && validation.detectedMimeType) {
          // Binary multimodal attachment (JPEG, PNG, WebP, GIF, PDF)
          validatedInlineParts.push({
            inlineData: {
              mimeType: validation.detectedMimeType,
              data: validation.cleanBase64,
            },
          });
        }
      }
    }

    // 2. Format Quoted / Referenced Messages Context
    let referencedContextBlock = "";
    if (Array.isArray(referencedMessages) && referencedMessages.length > 0) {
      const formattedQuotes = referencedMessages.map((ref, idx) => {
        const senderLabel = ref.sender === "user" ? "User" : "AI Coach";
        const timeLabel = ref.timestamp ? ` [${ref.timestamp}]` : "";
        return `[Reference #${idx + 1} - ${senderLabel}${timeLabel}]:\n"${ref.text.trim()}"`;
      });

      referencedContextBlock = [
        "=== REFERENCED PREVIOUS CONVERSATION CONTEXT (USER QUOTED THESE MESSAGES) ===",
        ...formattedQuotes,
        "=== END REFERENCED CONTEXT ===",
      ].join("\n");
    }

    await getDb();
    const todayStr = getTodayDateString();

    // 3. Check for Slash Commands or explicit Data Injection
    const parsedCmd = parseCoachCommand(safeMessage, requestedModel);

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
          const promptParts: string[] = [
            "=== USER COMPRESSED FITNESS DATA CONTEXT ===",
            textContext,
            "=== END DATA CONTEXT ===",
            "",
          ];

          if (referencedContextBlock) {
            promptParts.push(referencedContextBlock, "");
          }

          if (textFileBlocks.length > 0) {
            promptParts.push(...textFileBlocks, "");
          }

          promptParts.push(
            `User Query / Intent: "${parsedCmd.userPrompt || safeMessage || "Analyze attached data."}"`,
            parsedCmd.coachingFocus ? `Special Coaching Focus: ${parsedCmd.coachingFocus.replace(/_/g, " ")}` : "",
            `Current Date Reference: ${todayStr}`,
            "",
            "Coaching Directives:",
            "- Directly reference the user's actual averages, targets, volume trends, and weight change slopes from the context block.",
            "- If the user quoted previous messages, directly address their question or context in relation to those quotes.",
            "- If images or files are attached, analyze them in depth (e.g. food photos, workout sheets, physique check-ins, PDF reports).",
            "- Apply exercise physiology and sports nutrition principles (energy balance, volume landmarks MEV/MAV/MRV, protein threshold).",
            "- Use bold formatting for all numerical metrics and conclude with a concrete ⚡ Action Plan."
          );

          const contents: any[] = [...validatedInlineParts, promptParts.filter(Boolean).join("\n")];

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

    // 4. Default: Multi-item logging & conversational query
    let parsedResult: MultiLogResponse = {
      logItems: [],
      chatReply: "I received your message!",
      parseNotes: "",
    };

    const targetModel = resolveGeminiModel(requestedModel);

    if (process.env.GEMINI_API_KEY) {
      try {
        const promptParts: string[] = [];

        if (referencedContextBlock) {
          promptParts.push(referencedContextBlock, "");
        }

        if (textFileBlocks.length > 0) {
          promptParts.push(...textFileBlocks, "");
        }

        promptParts.push(
          `User Natural Language Input: "${safeMessage.trim() || "(User uploaded attachments)"}"`,
          `Today's Reference Date: ${todayStr}`,
          "",
          "Parsing & Coaching Instructions:",
          "1. If logging activities, extract all distinct items (meals, water, steps, weight, notes) into structured 'logItems'.",
          "2. For meals or food images/files: estimate realistic portions and scientific macronutrients using USDA references (Calories ≈ P*4 + C*4 + F*9).",
          "3. For water: convert amounts accurately to milliliters 'amountMl' (1 glass = 250ml, 1 bottle = 500ml, 1L = 1000ml).",
          "4. For weight: convert to kilograms 'weightKg' with 1 decimal precision.",
          "5. For step counts: extract total daily count 'count'.",
          "6. If the user referenced previous conversation messages, take their context into account when answering or confirming.",
          "7. If the input is purely a fitness or coaching question, leave 'logItems' empty and provide an expert coach answer in 'chatReply'.",
          "8. In 'chatReply', confirm exact numbers logged with an upbeat, professional tone or deliver sharp coaching advice."
        );

        const contents: any[] = [...validatedInlineParts, promptParts.join("\n")];

        const response = await genAI.models.generateContent({
          model: targetModel,
          contents,
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
            imageSource: validatedInlineParts.length > 0 ? "photo" : "text_only",
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
        const stepCalories = Math.round(count * 0.04);
        writePromises.push(
          DailyLog.findOneAndUpdate(
            { userId: session.userId, dateString: todayStr },
            {
              $max: { steps: count },
              $set: {
                stepsSyncedAt: new Date(),
                stepsSource: "manual",
                "caloriesOut.steps": stepCalories,
              },
              $setOnInsert: {
                date: new Date(),
                caloriesIn: 0,
                macros: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
                waterMl: 0,
                waterEntries: [],
              },
            },
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
