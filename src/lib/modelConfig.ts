/**
 * modelConfig.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source-of-truth for all model-related constants.
 *
 * ⚠️  After your first successful inference, open the browser DevTools console.
 *     You will see the raw output node names and tensor shapes logged there.
 *     Update DENOMINATION_CLASSES / AUTHENTICITY_CLASSES to match your model.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Path to the ONNX classifier model served from Next.js /public directory */
export const MODEL_PATH = "/models/currency_multitask.onnx";

/** Path to the ONNX detector model (YOLO26n) */
export const DETECTOR_MODEL_PATH = "/models/note_detector.onnx";

/** Pixel size the classifier model expects (both width and height). */
export const INPUT_SIZE = 224;

/** Pixel size the YOLO detector expects (both width and height). */
export const DETECTOR_INPUT_SIZE = 640;

/** Minimum confidence threshold for note detection. */
export const DETECTOR_CONF_THRESHOLD = 0.5;

/** Fraction of box width/height to pad around cropped note before classification. */
export const PAD_FRAC = 0.08;

/** Sigmoid authenticity score band [min, max] where status is deemed 'uncertain'. */
export const AUTH_UNCERTAIN_BAND: [number, number] = [0.35, 0.65];

/**
 * Indian denomination labels — confirmed class-index mapping from Currency.ipynb.
 * The model uses num_denoms=7 with CrossEntropyLoss.
 * Index 0 → ₹10, Index 1 → ₹20, … Index 6 → ₹2000.
 */
export const DENOMINATION_CLASSES: string[] = [
  "₹10",    // 0
  "₹20",    // 1
  "₹50",    // 2
  "₹100",   // 3
  "₹200",   // 4
  "₹500",   // 5
  "₹2000",  // 6
];

/**
 * Authenticity — single BCEWithLogitsLoss output.
 * sigmoid(auth_logit) ≥ 0.5 → Genuine, < 0.5 → Fake.
 * (No argmax needed — this array is only used for display labels.)
 */
export const AUTHENTICITY_CLASSES: string[] = ["Fake", "Genuine"];

/**
 * ImageNet per-channel mean used during training normalisation.
 * If your model was trained with different stats, update these.
 */
export const IMAGENET_MEAN: [number, number, number] = [0.485, 0.456, 0.406];

/**
 * ImageNet per-channel std used during training normalisation.
 */
export const IMAGENET_STD: [number, number, number] = [0.229, 0.224, 0.225];

export interface DetectionBox {
  x: number; // pixel top-left x in original frame
  y: number; // pixel top-left y in original frame
  w: number; // pixel width in original frame
  h: number; // pixel height in original frame
  confidence: number;
}

export interface DetectionResult {
  found: boolean;
  box: DetectionBox | null;
}

export type AuthStatus = "genuine" | "fake" | "uncertain";

export interface ClassificationResult {
  denomination: string;
  denominationIndex: number;
  denominationConfidence: number;
  authStatus: AuthStatus;
  authenticityScore: number;
  rawOutputs: Record<string, number[]>;
}

/** Legacy alias for backwards compatibility during migration */
export type InferenceResult = ClassificationResult & { isGenuine: boolean };

export type PipelineState =
  | { stage: "idle" }
  | { stage: "detecting" }
  | { stage: "not_found" }
  | { stage: "detected"; box: DetectionBox; boxedImage: string }
  | { stage: "classifying"; boxedImage: string }
  | { stage: "done"; result: ClassificationResult; boxedImage: string }
  | { stage: "error"; message: string };

