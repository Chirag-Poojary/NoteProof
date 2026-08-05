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

/** Path to the ONNX model served from Next.js /public directory */
export const MODEL_PATH = "/models/currency_multitask_edge_inline.onnx";

/** Pixel size the model expects (both width and height). */
export const INPUT_SIZE = 224;

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

/** Result shape returned from the inference hook. */
export interface InferenceResult {
  denomination: string;
  denominationIndex: number;
  denominationConfidence: number; // 0–1
  isGenuine: boolean;
  authenticityScore: number; // 0–1  (probability of "Genuine")
  rawOutputs: Record<string, number[]>; // for debugging
}
