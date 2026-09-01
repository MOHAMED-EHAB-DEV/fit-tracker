"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Camera,
  Upload,
  Sparkles,
  Check,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  ImageIcon,
  Flame,
  Dumbbell,
  Wheat,
  Droplet,
  Info,
  Layers,
  Edit3,
} from "lucide-react";
import { useClientResize } from "@/hooks/useClientResize";
import { MealType } from "@/types/fitness";
import { MEAL_TYPE_OPTIONS } from "@/constants/nutrition";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Chip } from "@/components/ui/Chip";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";

export function PhotoAnalyzer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { resizeImage, isResizing } = useClientResize();

  // Input states
  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [description, setDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analysis result & confirmation modal states
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [cloudinaryData, setCloudinaryData] = useState<any | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Modal Editable Form States
  const [editDescription, setEditDescription] = useState("");
  const [editMealType, setEditMealType] = useState<MealType>("lunch");
  const [editCalories, setEditCalories] = useState("");
  const [editProtein, setEditProtein] = useState("");
  const [editCarbs, setEditCarbs] = useState("");
  const [editFat, setEditFat] = useState("");
  const [editFiber, setEditFiber] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    try {
      const resized = await resizeImage(file, { maxDimension: 800, quality: 0.82 });
      setSelectedBlob(resized);
      setPreviewUrl(URL.createObjectURL(resized));
    } catch {
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
      formData.append("save", "false");
      if (dateParam) {
        formData.append("dateString", dateParam);
      }

      const res = await fetch("/api/meals/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze meal.");
      }

      const analysis = data.analysis;
      setAnalysisResult(analysis);
      setCloudinaryData(data.cloudinary || null);

      // Populate editable fields for the confirmation modal
      setEditDescription(analysis.mealDescription || description || "Logged Meal");
      setEditMealType(mealType);
      setEditCalories(String(analysis.totals?.calories ?? 0));
      setEditProtein(String(analysis.totals?.protein ?? 0));
      setEditCarbs(String(analysis.totals?.carbs ?? 0));
      setEditFat(String(analysis.totals?.fat ?? 0));
      setEditFiber(String(analysis.totals?.fiber ?? 0));
      setEditNotes(analysis.geminiNotes || "");

      // Open confirm modal for review and additional details
      setIsConfirmModalOpen(true);
    } catch (err: any) {
      setError(err.message || "Failed to analyze meal.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        description: editDescription.trim() || "Logged Meal",
        mealType: editMealType,
        dateString: dateParam,
        macros: {
          calories: parseInt(editCalories, 10) || 0,
          protein: parseFloat(editProtein) || 0,
          carbs: parseFloat(editCarbs) || 0,
          fat: parseFloat(editFat) || 0,
          fiber: parseFloat(editFiber) || 0,
        },
        aiMacros: analysisResult
          ? {
              calories: analysisResult.totals?.calories,
              protein: analysisResult.totals?.protein,
              carbs: analysisResult.totals?.carbs,
              fat: analysisResult.totals?.fat,
              fiber: analysisResult.totals?.fiber || 0,
              confidence: analysisResult.confidence || "medium",
              confidenceReason: analysisResult.confidenceReason || "",
              geminiNotes: editNotes || analysisResult.geminiNotes || "",
              modelUsed: analysisResult.modelUsed || "gemini-3.7-flash",
            }
          : null,
        cloudinary: cloudinaryData,
      };

      const res = await fetch("/api/meals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save meal.");
      }

      setIsConfirmModalOpen(false);
      setIsSaved(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to save confirmed meal.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDone = () => {
    if (dateParam) {
      router.push(`/nutrition?date=${dateParam}`);
    } else {
      router.push("/nutrition");
    }
    router.refresh();
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setCloudinaryData(null);
    setSelectedBlob(null);
    setPreviewUrl(null);
    setDescription("");
    setIsSaved(false);
    setIsConfirmModalOpen(false);
    setError(null);
  };

  const getConfidenceBadge = (confidence?: string) => {
    const level = confidence?.toLowerCase() || "medium";
    if (level === "high") {
      return (
        <Chip
          color="success"
          variant="flat"
          size="md"
          startContent={<ShieldCheck className="w-3.5 h-3.5" />}
        >
          High Confidence
        </Chip>
      );
    }
    if (level === "low") {
      return (
        <Chip
          color="danger"
          variant="flat"
          size="md"
          startContent={<AlertCircle className="w-3.5 h-3.5" />}
        >
          Low Confidence
        </Chip>
      );
    }
    return (
      <Chip
        color="warning"
        variant="flat"
        size="md"
        startContent={<AlertTriangle className="w-3.5 h-3.5" />}
      >
        Medium Confidence
      </Chip>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Main Analysis Input Card */}
      <Card variant="default" className="space-y-6">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                AI Food Photo Analyzer
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Snap a picture or describe your plate to estimate calories, macros & confidence level
              </p>
            </div>
          </div>
        </CardHeader>

        <CardBody className="space-y-6 pt-0">
          {error && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={galleryInputRef}
            onChange={handleFileChange}
            accept="image/*"
            aria-label="Upload meal photo from gallery"
            className="hidden"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            aria-label="Take meal photo with camera"
            className="hidden"
          />

          {/* Photo Capture / Upload Area */}
          <div className="space-y-3">
            {previewUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-950 aspect-video max-h-72 flex items-center justify-center group">
                <Image
                  src={previewUrl}
                  alt="Meal preview"
                  fill
                  onError={() => {
                    setPreviewUrl(null);
                    setSelectedBlob(null);
                  }}
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 text-white font-semibold text-sm transition">
                  <Button
                    type="button"
                    variant="bordered"
                    size="sm"
                    onClick={() => cameraInputRef.current?.click()}
                    startContent={<Camera className="w-4 h-4 text-emerald-400" />}
                  >
                    Camera
                  </Button>
                  <Button
                    type="button"
                    variant="bordered"
                    size="sm"
                    onClick={() => galleryInputRef.current?.click()}
                    startContent={<ImageIcon className="w-4 h-4 text-emerald-400" />}
                  >
                    Gallery
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-white/10 hover:border-emerald-500/50 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition bg-zinc-950/40 group">
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  aria-label="Upload photo from device"
                  className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <Camera className="w-7 h-7" aria-hidden="true" />
                </button>
                <p className="font-bold text-sm text-zinc-200">Take Photo or Upload Meal Image</p>
                <p className="text-xs text-zinc-500 mt-1 mb-4">
                  Automatic client-side optimization (800×800 WebP)
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <Button
                    type="button"
                    variant="flat"
                    size="sm"
                    onClick={() => cameraInputRef.current?.click()}
                    startContent={<Camera className="w-4 h-4 text-emerald-400" />}
                  >
                    Take Photo
                  </Button>
                  <Button
                    type="button"
                    variant="bordered"
                    size="sm"
                    onClick={() => galleryInputRef.current?.click()}
                    startContent={<Upload className="w-4 h-4 text-zinc-400" />}
                  >
                    Choose from Gallery
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Form Inputs: Meal Type & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Meal Type"
              value={mealType}
              onChange={(val) => setMealType(val as MealType)}
              options={MEAL_TYPE_OPTIONS}
            />

            <Input
              label="Description (Optional)"
              placeholder="e.g. 200g grilled chicken, 1 cup rice"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Analyze Action Trigger */}
          {!isSaved && (
            <Button
              type="button"
              variant="solid"
              size="lg"
              className="w-full"
              onClick={handleAnalyze}
              disabled={isAnalyzing || isResizing || (!selectedBlob && !description.trim())}
              isLoading={isAnalyzing || isResizing}
              startContent={!isAnalyzing && !isResizing ? <Sparkles className="w-5 h-5" /> : undefined}
            >
              {isResizing
                ? "Optimizing photo..."
                : isAnalyzing
                ? "Analyzing with Gemini AI..."
                : "Analyze Meal & Review Details"}
            </Button>
          )}
        </CardBody>
      </Card>

      {/* Confirmation Modal for Additional Details */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        size="2xl"
        title={
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400" aria-hidden="true">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>Confirm Meal Details</span>
          </div>
        }
        description="Review AI nutritional breakdown, confidence rating, and adjust details before logging."
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="bordered"
              size="md"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isSaving}
            >
              Cancel & Adjust
            </Button>
            <Button
              type="button"
              variant="solid"
              size="md"
              onClick={handleConfirmSave}
              isLoading={isSaving}
              startContent={<Check className="w-4 h-4" />}
            >
              Confirm & Log Meal
            </Button>
          </div>
        }
      >
        <div className="space-y-6 text-start">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Image Preview + AI Diagnostics + Caloric Ratio */}
            <div className="lg:col-span-5 space-y-4">
              {/* Photo Preview Thumbnail */}
              {previewUrl && (
                <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-white/10 shadow-lg bg-zinc-950">
                  <Image
                    src={previewUrl}
                    alt="Analyzed food photo"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 360px"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-zinc-950/80 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-2.5 inset-s-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900/90 backdrop-blur-md border border-white/10 text-[10px] font-bold text-zinc-300">
                      <Camera className="w-3 h-3 text-emerald-400" />
                      Visual Snapshot
                    </span>
                  </div>
                </div>
              )}

              {/* AI Confidence & Diagnostic Assessment */}
              {analysisResult && (
                <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/10 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                      <span>AI Diagnostic</span>
                    </span>
                    {getConfidenceBadge(analysisResult.confidence)}
                  </div>

                  {analysisResult.confidenceReason && (
                    <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                      {analysisResult.confidenceReason}
                    </p>
                  )}

                  {analysisResult.geminiNotes && (
                    <p className="text-xs text-zinc-400 italic bg-white/3 p-2.5 rounded-xl border border-white/5">
                      Dietitian Note: {analysisResult.geminiNotes}
                    </p>
                  )}
                </div>
              )}

              {/* Live Caloric Distribution Bar */}
              {(() => {
                const p = parseFloat(editProtein) || 0;
                const c = parseFloat(editCarbs) || 0;
                const f = parseFloat(editFat) || 0;
                const cal = parseInt(editCalories, 10) || (p * 4 + c * 4 + f * 9) || 1;
                const pCal = p * 4;
                const cCal = c * 4;
                const fCal = f * 9;
                const totalMacroCal = pCal + cCal + fCal || 1;
                const pPct = Math.round((pCal / totalMacroCal) * 100);
                const cPct = Math.round((cCal / totalMacroCal) * 100);
                const fPct = Math.max(0, 100 - pPct - cPct);

                return (
                  <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">
                        Energy Distribution
                      </span>
                      <span className="text-zinc-300 font-extrabold tabular-nums">
                        {cal} kcal
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden flex border border-white/5">
                      <div style={{ width: `${pPct}%` }} className="h-full bg-emerald-500 transition-all duration-300" title={`Protein: ${pPct}%`} />
                      <div style={{ width: `${cPct}%` }} className="h-full bg-amber-400 transition-all duration-300" title={`Carbs: ${cPct}%`} />
                      <div style={{ width: `${fPct}%` }} className="h-full bg-orange-500 transition-all duration-300" title={`Fat: ${fPct}%`} />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-semibold pt-0.5">
                      <span className="text-emerald-400 tabular-nums">P: {pPct}%</span>
                      <span className="text-amber-400 tabular-nums">C: {cPct}%</span>
                      <span className="text-orange-400 tabular-nums">F: {fPct}%</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Right Column: Editable Inputs + Ingredients */}
            <div className="lg:col-span-7 space-y-4">
              {/* Editable Main Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Input
                  label="Meal Description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  startContent={<Edit3 className="w-4 h-4" />}
                  placeholder="e.g. Grilled Chicken Bowl"
                />
                <Select
                  label="Meal Type"
                  value={editMealType}
                  onChange={(val) => setEditMealType(val as MealType)}
                  options={MEAL_TYPE_OPTIONS}
                />
              </div>

              {/* Editable Macronutrient Totals */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 select-none">
                  Macronutrient Targets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <Input
                    label="Calories (kcal)"
                    type="number"
                    value={editCalories}
                    onChange={(e) => setEditCalories(e.target.value)}
                    startContent={<Flame className="w-3.5 h-3.5 text-amber-400" />}
                  />
                  <Input
                    label="Protein (g)"
                    type="number"
                    step="0.1"
                    value={editProtein}
                    onChange={(e) => setEditProtein(e.target.value)}
                    startContent={<Dumbbell className="w-3.5 h-3.5 text-emerald-400" />}
                  />
                  <Input
                    label="Carbs (g)"
                    type="number"
                    step="0.1"
                    value={editCarbs}
                    onChange={(e) => setEditCarbs(e.target.value)}
                    startContent={<Wheat className="w-3.5 h-3.5 text-amber-300" />}
                  />
                  <Input
                    label="Fat (g)"
                    type="number"
                    step="0.1"
                    value={editFat}
                    onChange={(e) => setEditFat(e.target.value)}
                    startContent={<Droplet className="w-3.5 h-3.5 text-orange-400" />}
                  />
                  <Input
                    label="Fiber (g)"
                    type="number"
                    step="0.1"
                    value={editFiber}
                    onChange={(e) => setEditFiber(e.target.value)}
                    startContent={<Layers className="w-3.5 h-3.5 text-teal-400" />}
                  />
                </div>
              </div>

              {/* Ingredient Breakdown Section */}
              {analysisResult?.items && analysisResult.items.length > 0 && (
                <div className="space-y-2">
                  <span className="block text-xs font-bold uppercase tracking-wider text-zinc-400 select-none">
                    Detected Ingredient Breakdown ({analysisResult.items.length} items)
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pe-1">
                    {analysisResult.items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-zinc-950/50 border border-white/5 hover:border-white/10 transition"
                      >
                        <div className="truncate me-2">
                          <span className="text-zinc-200 font-semibold">{item.name}</span>
                          <span className="text-zinc-500 ms-1.5">({item.quantity})</span>
                        </div>
                        <div className="flex items-center gap-3 text-zinc-400 shrink-0 font-medium">
                          <span className="text-white tabular-nums">{item.calories} kcal</span>
                          <span className="text-emerald-400 tabular-nums">P: {item.protein}g</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Notes */}
              <Input
                label="Additional Notes / Cooking Details (Optional)"
                placeholder="e.g. 1 tbsp extra virgin olive oil used for cooking"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Saved Success Region */}
      {isSaved && analysisResult && (
        <Card variant="bordered" className="border-emerald-500/40 shadow-2xl space-y-5 animate-in fade-in duration-200">
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                <Check className="w-5 h-5" aria-hidden="true" />
                <span>Meal Logged Successfully!</span>
              </div>
              {getConfidenceBadge(analysisResult.confidence)}
            </div>
          </CardHeader>

          <CardBody className="space-y-4 pt-0">
            <p className="font-bold text-lg text-white">
              {editDescription || analysisResult.mealDescription}
            </p>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-zinc-950/80 border border-white/10">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Calories</span>
                <span className="text-lg font-bold text-white mt-0.5 block tabular-nums">
                  {editCalories}
                </span>
                <span className="text-[10px] text-zinc-500">kcal</span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-950/80 border border-white/10">
                <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Protein</span>
                <span className="text-lg font-bold text-emerald-300 mt-0.5 block tabular-nums">
                  {editProtein}g
                </span>
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {Math.round(((parseFloat(editProtein) * 4) / (parseFloat(editCalories) || 1)) * 100 || 0)}%
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-950/80 border border-white/10">
                <span className="text-[10px] text-amber-400 uppercase font-semibold block">Carbs</span>
                <span className="text-lg font-bold text-amber-300 mt-0.5 block tabular-nums">
                  {editCarbs}g
                </span>
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {Math.round(((parseFloat(editCarbs) * 4) / (parseFloat(editCalories) || 1)) * 100 || 0)}%
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-950/80 border border-white/10">
                <span className="text-[10px] text-orange-400 uppercase font-semibold block">Fat</span>
                <span className="text-lg font-bold text-orange-300 mt-0.5 block tabular-nums">
                  {editFat}g
                </span>
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {Math.round(((parseFloat(editFat) * 9) / (parseFloat(editCalories) || 1)) * 100 || 0)}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                variant="solid"
                size="md"
                className="flex-1"
                onClick={handleDone}
              >
                Done & View Log
              </Button>
              <Button
                type="button"
                variant="bordered"
                size="md"
                onClick={handleReset}
              >
                Log Another
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

export default PhotoAnalyzer;
