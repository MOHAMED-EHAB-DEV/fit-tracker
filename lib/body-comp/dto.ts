/** Check-in shape sent to the browser (isomorphic types only). All values metric. */

export interface CheckInMeasurementsDTO {
  chest: number | null;
  waist: number | null;
  hips: number | null;
  arms: number | null;
  thighs: number | null;
}

export interface CheckInPhotoDTO {
  angle: "front" | "side" | "back";
  /** Short-lived signed URL; null when the asset reference is unknown. */
  url: string | null;
  /** ISO time the URL stops working. */
  expiresAt: string | null;
}

export interface CheckInAnalysisDTO {
  qualitativeNotes: string;
  estimatedBodyFatPercent: number | null;
  estimatedBodyFatRange: string;
  comparedToPrevious: string;
  muscleGroupHighlights: string[];
  recommendations: string[];
  modelUsed: string;
  generatedAt: string | null;
}

export interface CheckInDTO {
  _id: string;
  /** "YYYY-MM-DD" in the user's zone. */
  dateString: string;
  /** ISO instant of the check-in. */
  checkInDate: string;
  weightKg: number | null;
  /** Measured by the user. */
  bodyFatPercent: number | null;
  /** Centimetres. */
  measurements: CheckInMeasurementsDTO | null;
  notes: string;
  photos: CheckInPhotoDTO[];
  aiAnalysis: CheckInAnalysisDTO | null;
}

/** An AI estimate the user has seen and may attach to the check-in they save. */
export interface AnalysisPreviewDTO {
  qualitativeNotes: string;
  estimatedBodyFatPercent: number | null;
  estimatedBodyFatRange: string;
  comparedToPrevious: string;
  muscleGroupHighlights: string[];
  recommendations: string[];
  modelUsed: string;
  generatedAt: string;
}
