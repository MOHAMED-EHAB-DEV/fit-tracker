"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Trash2,
  Plus,
} from "lucide-react";
import { useClientResize } from "@/hooks/useClientResize";
import { MealType } from "@/types/fitness";
import { MEAL_TYPE_OPTIONS } from "@/constants/nutrition";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Chip } from "@/components/ui/Chip";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface AttachedPhoto {
  id: string;
  blob: Blob;
  previewUrl: string;
  name: string;
}

export function PhotoAnalyzer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { resizeImages, isResizing } = useClientResize();

  // Input states
  const [attachedPhotos, setAttachedPhotos] = useState<AttachedPhoto[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [description, setDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analysis result & confirmation modal states
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [imagesData, setImagesData] = useState<any[]>([]);
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
  const [editItems, setEditItems] = useState<any[]>([]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      attachedPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, [attachedPhotos]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    e.target.value = "";

    setError(null);
    try {
      const resizedBlobs = await resizeImages(files, {
        maxDimension: 800,
        quality: 0.82,
      });

      const newPhotos: AttachedPhoto[] = resizedBlobs.map((blob, idx) => ({
        id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        blob,
        previewUrl: URL.createObjectURL(blob),
        name: files[idx]?.name || `meal-photo-${idx + 1}.webp`,
      }));

      setAttachedPhotos((prev) => [...prev, ...newPhotos]);
    } catch {
      setError("Failed to process image(s). Please try again.");
    }
  };

  const handleRemovePhoto = (id: string) => {
    setAttachedPhotos((prev) => {
      const toRemove = prev.find((p) => p.id === id);
      if (toRemove) {
        URL.revokeObjectURL(toRemove.previewUrl);
      }
      const filtered = prev.filter((p) => p.id !== id);
      if (activePhotoIndex >= filtered.length) {
        setActivePhotoIndex(Math.max(0, filtered.length - 1));
      }
      return filtered;
    });
  };

  const handleAnalyze = async () => {
    if (attachedPhotos.length === 0 && !description.trim()) {
      setError("Please attach at least one photo or enter a meal description.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      attachedPhotos.forEach((photo, idx) => {
        formData.append("files", photo.blob, `meal_${idx + 1}.webp`);
      });
      if (attachedPhotos.length > 0) {
        formData.append("file", attachedPhotos[0].blob, "meal_primary.webp");
      }

      formData.append("description", description);
      formData.append("mealType", mealType);
      formData.append("save", "false");
      if (dateParam) {
        formData.append("dateString", dateParam);
      }
      if (editItems.length > 0) {
        formData.append("previousItems", JSON.stringify(editItems));
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
      setImagesData(data.images || []);

      // Populate editable fields for the confirmation modal
      setEditDescription(analysis.mealDescription || description || "Logged Meal");
      setEditMealType(mealType);
      setEditCalories(String(analysis.totals?.calories ?? 0));
      setEditProtein(String(analysis.totals?.protein ?? 0));
      setEditCarbs(String(analysis.totals?.carbs ?? 0));
      setEditFat(String(analysis.totals?.fat ?? 0));
      setEditFiber(String(analysis.totals?.fiber ?? 0));
      setEditNotes(analysis.geminiNotes || "");
      setEditItems(analysis.items || []);

      // Open confirm modal for review and additional details
      setIsConfirmModalOpen(true);
    } catch (err: any) {
      setError(err.message || "Failed to analyze meal.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRemoveItem = (index: number) => {
    const updated = editItems.filter((_, idx) => idx !== index);
    setEditItems(updated);
  };

  const handleSyncTotalsFromItems = () => {
    if (editItems.length === 0) return;
    const totalCal = editItems.reduce((acc, it) => acc + (Number(it.calories) || 0), 0);
    const totalP = editItems.reduce((acc, it) => acc + (Number(it.protein) || 0), 0);
    const totalC = editItems.reduce((acc, it) => acc + (Number(it.carbs) || 0), 0);
    const totalF = editItems.reduce((acc, it) => acc + (Number(it.fat) || 0), 0);
    const totalFib = editItems.reduce((acc, it) => acc + (Number(it.fiber) || 0), 0);
    setEditCalories(String(Math.round(totalCal)));
    setEditProtein(totalP.toFixed(1));
    setEditCarbs(totalC.toFixed(1));
    setEditFat(totalF.toFixed(1));
    setEditFiber(totalFib.toFixed(1));
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        description: editDescription.trim() || "Logged Meal",
        mealType: editMealType,
        dateString: dateParam,
        items: editItems,
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
        images: imagesData,
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
    attachedPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    setAttachedPhotos([]);
    setActivePhotoIndex(0);
    setAnalysisResult(null);
    setImagesData([]);
    setDescription("");
    setEditItems([]);
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

  const activePhoto =
    attachedPhotos[activePhotoIndex] || attachedPhotos[0] || null;

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
                Snap or attach multiple photos of your plate to estimate calories & macros with AI
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

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            multiple
            aria-label="Upload meal photos"
            className="hidden"
          />

          {/* Photo Capture / Upload Area */}
          <div className="space-y-3">
            {attachedPhotos.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Attached Photos ({attachedPhotos.length})
                  </span>

                  <Button
                    type="button"
                    variant="bordered"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    startContent={<Plus className="w-3.5 h-3.5 text-emerald-400" />}
                  >
                    Add Photos
                  </Button>
                </div>

                {/* Photo Grid Preview */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {attachedPhotos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-950 aspect-4/3 group"
                    >
                      <Image
                        src={photo.previewUrl}
                        alt={`Attached meal photo ${idx + 1}`}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-zinc-950/80 via-transparent to-transparent pointer-events-none" />

                      <div className="absolute top-2 inset-s-2">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-950/85 backdrop-blur-md border border-white/10 text-[10px] font-bold text-zinc-300">
                          #{idx + 1}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(photo.id)}
                        className="absolute top-2 inset-e-2 p-1.5 rounded-lg bg-zinc-950/85 border border-white/10 text-zinc-400 hover:text-red-400 hover:bg-red-500/20 transition cursor-pointer"
                        title="Remove photo"
                        aria-label={`Remove photo ${idx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Add more tile */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-2xl border-2 border-dashed border-white/10 hover:border-emerald-500/50 bg-zinc-950/40 flex flex-col items-center justify-center p-3 gap-2 min-h-27.5 transition text-center cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    aria-label="Add another photo"
                  >
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-105 transition">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-zinc-400 group-hover:text-zinc-200">
                      Add photo
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/10 hover:border-emerald-500/50 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition bg-zinc-950/40 group cursor-pointer"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Camera className="w-7 h-7" aria-hidden="true" />
                </div>
                <p className="font-bold text-sm text-zinc-200">
                  Take Photo or Upload Meal Images
                </p>
                <p className="text-xs text-zinc-500 mt-1 mb-4">
                  Select single or multiple photos (plates, side dishes, nutrition labels)
                </p>

                <Button
                  type="button"
                  variant="flat"
                  size="md"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  startContent={<Upload className="w-4 h-4 text-emerald-400" />}
                >
                  Choose or Take Photos
                </Button>
              </div>
            )}
          </div>

          {/* Form Inputs: Meal Type & Description */}
          <div className="space-y-4">
            <Select
              label="Meal Type"
              value={mealType}
              onChange={(val) => setMealType(val as MealType)}
              options={MEAL_TYPE_OPTIONS}
            />

            <Textarea
              label="Description (Optional)"
              placeholder="e.g. 200g grilled chicken breast, 1 cup jasmine rice, steamed broccoli with 1 tbsp olive oil..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minRows={3}
              maxRows={8}
              description="Detail ingredients, exact weights, cooking oils, or sauces to boost AI precision."
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
              disabled={
                isAnalyzing ||
                isResizing ||
                (attachedPhotos.length === 0 && !description.trim())
              }
              isLoading={isAnalyzing || isResizing}
              startContent={
                !isAnalyzing && !isResizing ? (
                  <Sparkles className="w-5 h-5" />
                ) : undefined
              }
            >
              {isResizing || isAnalyzing
                ? "Analyzing meal with AI..."
                : attachedPhotos.length > 1
                ? `Analyze Meal (${attachedPhotos.length} Photos)`
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
            <div
              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400"
              aria-hidden="true"
            >
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
              {activePhoto && (
                <div className="space-y-2">
                  <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-white/10 shadow-lg bg-zinc-950">
                    <Image
                      src={activePhoto.previewUrl}
                      alt="Analyzed food photo"
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 360px"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-zinc-950/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-2.5 inset-s-3 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900/90 backdrop-blur-md border border-white/10 text-[10px] font-bold text-zinc-300">
                        <Camera className="w-3 h-3 text-emerald-400" />
                        Visual Snapshot #{activePhotoIndex + 1}
                      </span>
                    </div>
                  </div>

                  {/* Multi-Photo Thumbnail Selector Strip */}
                  {attachedPhotos.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {attachedPhotos.map((photo, idx) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => setActivePhotoIndex(idx)}
                          className={cn(
                            "relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer",
                            activePhotoIndex === idx
                              ? "border-emerald-400 ring-2 ring-emerald-400/30 scale-105"
                              : "border-white/10 hover:border-white/30 opacity-70 hover:opacity-100"
                          )}
                          title={`View photo ${idx + 1}`}
                        >
                          <Image
                            src={photo.previewUrl}
                            alt={`Photo thumbnail ${idx + 1}`}
                            fill
                            className="object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
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
                const cal =
                  parseInt(editCalories, 10) || p * 4 + c * 4 + f * 9 || 1;
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
                      <div
                        style={{ width: `${pPct}%` }}
                        className="h-full bg-emerald-500 transition-all duration-300"
                        title={`Protein: ${pPct}%`}
                      />
                      <div
                        style={{ width: `${cPct}%` }}
                        className="h-full bg-amber-400 transition-all duration-300"
                        title={`Carbs: ${cPct}%`}
                      />
                      <div
                        style={{ width: `${fPct}%` }}
                        className="h-full bg-orange-500 transition-all duration-300"
                        title={`Fat: ${fPct}%`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-semibold pt-0.5">
                      <span className="text-emerald-400 tabular-nums">
                        P: {pPct}%
                      </span>
                      <span className="text-amber-400 tabular-nums">
                        C: {cPct}%
                      </span>
                      <span className="text-orange-400 tabular-nums">
                        F: {fPct}%
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Right Column: Editable Inputs + Ingredients */}
            <div className="lg:col-span-7 space-y-4">
              {/* Editable Main Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Textarea
                  label="Meal Description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  startContent={<Edit3 className="w-4 h-4" />}
                  placeholder="e.g. Grilled Chicken Bowl"
                  minRows={2}
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
                    startContent={
                      <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
                    }
                  />
                  <Input
                    label="Carbs (g)"
                    type="number"
                    step="0.1"
                    value={editCarbs}
                    onChange={(e) => setEditCarbs(e.target.value)}
                    startContent={
                      <Wheat className="w-3.5 h-3.5 text-amber-300" />
                    }
                  />
                  <Input
                    label="Fat (g)"
                    type="number"
                    step="0.1"
                    value={editFat}
                    onChange={(e) => setEditFat(e.target.value)}
                    startContent={
                      <Droplet className="w-3.5 h-3.5 text-orange-400" />
                    }
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
              {editItems && editItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="block text-xs font-bold uppercase tracking-wider text-zinc-400 select-none">
                      Detected Ingredient Breakdown ({editItems.length} items)
                    </span>
                    {editItems.length !== (analysisResult?.items?.length ?? 0) && (
                      <button
                        type="button"
                        onClick={handleSyncTotalsFromItems}
                        className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                      >
                        Recalculate Totals
                      </button>
                    )}
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-2 pe-1">
                    {editItems.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-1.5 p-3 rounded-xl bg-zinc-950/60 border border-white/6 hover:border-white/12 transition text-start"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate me-2">
                            <span className="text-zinc-200 font-bold text-xs">
                              {item.name}
                            </span>
                            {item.quantity && (
                              <span className="text-zinc-400 text-[11px] font-medium ms-1.5">
                                ({item.quantity})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-amber-400 font-extrabold text-xs tabular-nums bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              {Math.round(Number(item.calories) || 0)} kcal
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                              title="Remove ingredient"
                              aria-label={`Remove ${item.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* All ingredient macros */}
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold pt-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tabular-nums">
                            P: {Number(item.protein || 0).toFixed(1)}g
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 tabular-nums">
                            C: {Number(item.carbs || 0).toFixed(1)}g
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20 tabular-nums">
                            F: {Number(item.fat || 0).toFixed(1)}g
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/20 tabular-nums">
                            Fib: {Number(item.fiber || 0).toFixed(1)}g
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Notes */}
              <Textarea
                label="Additional Notes / Cooking Details (Optional)"
                placeholder="e.g. 1 tbsp extra virgin olive oil used for cooking"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                minRows={2}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Saved Success Region */}
      {isSaved && analysisResult && (
        <Card
          variant="bordered"
          className="border-emerald-500/40 shadow-2xl space-y-5 animate-in fade-in duration-200"
        >
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

            {/* Saved Photos Thumbnails */}
            {attachedPhotos.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {attachedPhotos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-zinc-950"
                  >
                    <Image
                      src={photo.previewUrl}
                      alt={`Logged photo ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-zinc-950/80 border border-white/10">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                  Calories
                </span>
                <span className="text-lg font-bold text-white mt-0.5 block tabular-nums">
                  {editCalories}
                </span>
                <span className="text-[10px] text-zinc-500">kcal</span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-950/80 border border-white/10">
                <span className="text-[10px] text-emerald-400 uppercase font-semibold block">
                  Protein
                </span>
                <span className="text-lg font-bold text-emerald-300 mt-0.5 block tabular-nums">
                  {editProtein}g
                </span>
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {Math.round(
                    ((parseFloat(editProtein) * 4) /
                      (parseFloat(editCalories) || 1)) *
                      100 || 0
                  )}
                  %
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-950/80 border border-white/10">
                <span className="text-[10px] text-amber-400 uppercase font-semibold block">
                  Carbs
                </span>
                <span className="text-lg font-bold text-amber-300 mt-0.5 block tabular-nums">
                  {editCarbs}g
                </span>
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {Math.round(
                    ((parseFloat(editCarbs) * 4) /
                      (parseFloat(editCalories) || 1)) *
                      100 || 0
                  )}
                  %
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-950/80 border border-white/10">
                <span className="text-[10px] text-orange-400 uppercase font-semibold block">
                  Fat
                </span>
                <span className="text-lg font-bold text-orange-300 mt-0.5 block tabular-nums">
                  {editFat}g
                </span>
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {Math.round(
                    ((parseFloat(editFat) * 9) /
                      (parseFloat(editCalories) || 1)) *
                      100 || 0
                  )}
                  %
                </span>
              </div>
            </div>

            {editItems && editItems.length > 0 && (
              <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/5 space-y-1.5 text-start">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Logged Ingredients ({editItems.length})
                </span>
                <p className="text-xs text-zinc-300">
                  {editItems.map((it) => it.name).join(", ")}
                </p>
              </div>
            )}

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
