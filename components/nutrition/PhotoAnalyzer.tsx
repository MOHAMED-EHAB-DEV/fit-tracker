"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Upload, Sparkles, Check, AlertCircle, Loader2, RefreshCw, ImageIcon } from "lucide-react";
import { useClientResize } from "@/hooks/useClientResize";
import { MealType } from "@/types/fitness";
import { MEAL_TYPE_OPTIONS } from "@/constants/nutrition";

export function PhotoAnalyzer() {
  const router = useRouter();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { resizeImage, isResizing } = useClientResize();

  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [description, setDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear input value so selecting the same file consecutively triggers onChange
    e.target.value = "";
    if (!file) return;

    setError(null);
    try {
      const resized = await resizeImage(file, { maxDimension: 800, quality: 0.82 });
      setSelectedBlob(resized);
      setPreviewUrl(URL.createObjectURL(resized));
    } catch (err: any) {
      setError("Failed to process image. Please try again.");
    }
  };

  const handleAnalyze = async () => {
    if (!selectedBlob && !description.trim()) {
      setError("Please select a photo or enter a meal description.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      if (selectedBlob) {
        formData.append("file", selectedBlob, "meal.webp");
      }
      formData.append("description", description);
      formData.append("mealType", mealType);

      const res = await fetch("/api/meals/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze meal.");
      }

      setAnalysisResult(data.analysis);
    } catch (err: any) {
      setError(err.message || "Failed to analyze meal.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDone = () => {
    router.push("/nutrition");
    router.refresh();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <span>AI Food Photo Analyzer</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Snap a picture of your plate or upload an image to automatically estimate calories & macros
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Hidden Inputs for General File Chooser and Direct Camera */}
        <input
          type="file"
          ref={galleryInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
        <input
          type="file"
          ref={cameraInputRef}
          onChange={handleFileChange}
          accept="image/*"
          capture="environment"
          className="hidden"
        />

        {/* Photo Upload / Camera Area */}
        <div className="space-y-3">
          {previewUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-zinc-700 bg-zinc-950 aspect-video max-h-72 flex items-center justify-center group">
              <Image
                src={previewUrl}
                alt="Meal preview"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 text-white font-semibold text-sm transition">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-3 py-2 bg-zinc-800/90 hover:bg-zinc-700 rounded-lg flex items-center gap-1.5 text-xs transition"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="px-3 py-2 bg-zinc-800/90 hover:bg-zinc-700 rounded-lg flex items-center gap-1.5 text-xs transition"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span>Gallery</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition bg-zinc-950/40 group">
              <div
                onClick={() => galleryInputRef.current?.click()}
                className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform cursor-pointer"
              >
                <Camera className="w-7 h-7" />
              </div>
              <p className="font-bold text-sm text-zinc-200">Take Photo or Upload Meal Image</p>
              <p className="text-xs text-zinc-500 mt-1 mb-4">Automatic client-side optimization (800×800 WebP)</p>

              {/* Action Buttons for explicit mobile choice */}
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold rounded-xl text-xs flex items-center gap-2 transition"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Take Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-200 font-semibold rounded-xl text-xs flex items-center gap-2 transition"
                >
                  <Upload className="w-4 h-4 text-zinc-400" />
                  <span>Choose from Gallery</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Meal Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Meal Type
            </label>
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value as MealType)}
              className="w-full px-3.5 py-2.5 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              {MEAL_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 200g chicken breast, 1 cup white rice"
              className="w-full px-3.5 py-2.5 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        {/* Action Button */}
        {!analysisResult ? (
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing || isResizing || (!selectedBlob && !description.trim())}
            className="w-full py-3.5 px-4 bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing || isResizing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{isResizing ? "Optimizing photo..." : "Analyzing with Gemini AI..."}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Analyze & Log Meal</span>
              </>
            )}
          </button>
        ) : null}
      </div>

      {/* Analysis Result Card */}
      {analysisResult && (
        <div className="p-6 rounded-2xl bg-zinc-900/90 border border-emerald-500/40 space-y-5 shadow-2xl shadow-emerald-950/20 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
              <Check className="w-5 h-5" />
              <span>Meal Analyzed & Saved!</span>
            </div>
            <span className="text-xs uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Confidence: {analysisResult.confidence}
            </span>
          </div>

          <p className="font-semibold text-lg text-white">
            {analysisResult.mealDescription}
          </p>

          {/* Macro Summary Grid */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Calories</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{analysisResult.totals?.calories}</span>
              <span className="text-[10px] text-zinc-500">kcal</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800">
              <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Protein</span>
              <span className="text-lg font-bold text-emerald-300 mt-0.5 block">{analysisResult.totals?.protein}g</span>
              <span className="text-[10px] text-zinc-500">{Math.round((analysisResult.totals?.protein * 4 / analysisResult.totals?.calories) * 100 || 0)}%</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800">
              <span className="text-[10px] text-amber-400 uppercase font-semibold block">Carbs</span>
              <span className="text-lg font-bold text-amber-300 mt-0.5 block">{analysisResult.totals?.carbs}g</span>
              <span className="text-[10px] text-zinc-500">{Math.round((analysisResult.totals?.carbs * 4 / analysisResult.totals?.calories) * 100 || 0)}%</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800">
              <span className="text-[10px] text-orange-400 uppercase font-semibold block">Fat</span>
              <span className="text-lg font-bold text-orange-300 mt-0.5 block">{analysisResult.totals?.fat}g</span>
              <span className="text-[10px] text-zinc-500">{Math.round((analysisResult.totals?.fat * 9 / analysisResult.totals?.calories) * 100 || 0)}%</span>
            </div>
          </div>

          {/* Breakdown Items */}
          {analysisResult.items && analysisResult.items.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Ingredient Breakdown
              </h4>
              <div className="space-y-1.5">
                {analysisResult.items.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/60"
                  >
                    <span className="text-zinc-200 font-medium">
                      {item.name} <span className="text-zinc-500">({item.quantity})</span>
                    </span>
                    <div className="flex items-center gap-3 text-zinc-400">
                      <span className="font-semibold text-white">{item.calories} kcal</span>
                      <span className="text-emerald-400">P: {item.protein}g</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysisResult.geminiNotes && (
            <p className="text-xs text-zinc-400 italic bg-zinc-950/40 p-3 rounded-xl border border-zinc-800/60">
              Note: {analysisResult.geminiNotes}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleDone}
              className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl transition shadow-lg shadow-emerald-500/20"
            >
              Done & View Log
            </button>
            <button
              onClick={() => {
                setAnalysisResult(null);
                setSelectedBlob(null);
                setPreviewUrl(null);
                setDescription("");
              }}
              className="py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-xl text-xs transition"
            >
              Log Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PhotoAnalyzer;
