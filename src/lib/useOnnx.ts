"use client";

/**
 * useOnnx.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Inference hook for currency_multitask_edge.onnx
 *
 * Model: EfficientNet-B3 backbone + two task heads (from Currency.ipynb)
 *   Input  → "input_image"   : float32[1, 3, 224, 224]  (CHW, ImageNet normalised)
 *   Output → "denom_logits"  : float32[1, 7]            (raw CrossEntropy logits)
 *   Output → "auth_logits"   : float32[1]               (raw BCEWithLogits logit)
 *
 * Preprocessing matches val_transform in notebook:
 *   A.Resize(224, 224)  →  A.Normalize(mean, std)  →  ToTensorV2()
 *   i.e. resize to 224×224 square, then (pixel/255 − mean) / std per channel.
 *
 * Fixes applied vs. previous version:
 *  1. ONNX model must be a single self-contained file (no .onnx.data).
 *     See colab_reexport_cell.py to regenerate it from your checkpoint.
 *  2. wasmPaths → /ort-wasm/ (local, same-origin) to satisfy COEP.
 *  3. numThreads = 1 to avoid SharedArrayBuffer / Worker .mjs fetch.
 *  4. Input/output nodes addressed by name, not positional index.
 *  5. auth_logits is shape [1] — sigmoid of the single scalar.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useRef, useState, useCallback } from "react";
import {
  MODEL_PATH,
  INPUT_SIZE,
  IMAGENET_MEAN,
  IMAGENET_STD,
  DENOMINATION_CLASSES,
  type InferenceResult,
} from "./modelConfig";

// ── Node name constants (from torch.onnx.export in Currency.ipynb) ──────────
const INPUT_NODE  = "input_image";
const DENOM_NODE  = "denom_logits";
const AUTH_NODE   = "auth_logits";

export interface UseOnnxReturn {
  isLoading: boolean;
  isModelReady: boolean;
  error: string | null;
  runInference: (canvas: HTMLCanvasElement) => Promise<InferenceResult | null>;
}

/**
 * fetchAndCacheModel
 * Downloads the ONNX model and caches it persistently in IndexedDB.
 * Subsequent visits will load instantly from disk, completely bypassing the network.
 */
async function fetchAndCacheModel(modelUrl: string): Promise<ArrayBuffer> {
  const DB_NAME = "onnx-model-cache";
  const STORE_NAME = "models";
  const MODEL_KEY = modelUrl;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const getReq = store.get(MODEL_KEY);

      getReq.onsuccess = async () => {
        if (getReq.result) {
          console.log("[OnnxRuntime] Loaded model instantly from IndexedDB cache");
          resolve(getReq.result);
        } else {
          console.log("[OnnxRuntime] Fetching model from network...", modelUrl);
          try {
            const response = await fetch(modelUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            
            // Save to IDB for next time
            const writeTx = db.transaction([STORE_NAME], "readwrite");
            const writeStore = writeTx.objectStore(STORE_NAME);
            writeStore.put(arrayBuffer, MODEL_KEY);
            
            console.log("[OnnxRuntime] Saved model to IndexedDB cache for future visits");
            resolve(arrayBuffer);
          } catch (err) {
            reject(err);
          }
        }
      };

      getReq.onerror = async () => {
        // Fallback to standard fetch if IndexedDB read fails
        try {
          const response = await fetch(modelUrl);
          resolve(await response.arrayBuffer());
        } catch(err) {
          reject(err);
        }
      };
    };

    request.onerror = async () => {
      // Fallback to standard fetch if IndexedDB is blocked (e.g. Incognito mode)
      try {
        const response = await fetch(modelUrl);
        resolve(await response.arrayBuffer());
      } catch(err) {
        reject(err);
      }
    };
  });
}

export function useOnnx(): UseOnnxReturn {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null);
  const [isLoading, setIsLoading]     = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  /* ── helpers ──────────────────────────────────────────────────────────────── */

  const softmax = (arr: number[]): number[] => {
    const max  = Math.max(...arr);
    const exps = arr.map((v) => Math.exp(v - max));
    const sum  = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sum);
  };

  const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

  /**
   * canvasToTensor
   * Matches val_transform from Currency.ipynb:
   *   A.Resize(224, 224)  — done upstream when drawing to canvas
   *   A.Normalize(mean, std)  — pixel/255, then (v − mean) / std
   *   ToTensorV2()  — HWC → CHW
   *
   * Returns a Float32Array in CHW layout: [3, 224, 224]
   * wrapped in a batch-1 tensor: [1, 3, 224, 224]
   */
  const canvasToTensor = (canvas: HTMLCanvasElement): Float32Array => {
    const ctx    = canvas.getContext("2d")!;
    const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE); // RGBA uint8

    const ch      = INPUT_SIZE * INPUT_SIZE;          // pixels per channel
    const tensor  = new Float32Array(3 * ch);         // [3, H, W]

    for (let i = 0; i < ch; i++) {
      const r = data[i * 4]     / 255;
      const g = data[i * 4 + 1] / 255;
      const b = data[i * 4 + 2] / 255;

      tensor[i]          = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];  // R
      tensor[ch + i]     = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];  // G
      tensor[2 * ch + i] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];  // B
    }

    return tensor;
  };

  /* ── main inference callback ──────────────────────────────────────────────── */

  const runInference = useCallback(
    async (canvas: HTMLCanvasElement): Promise<InferenceResult | null> => {
      if (typeof window === "undefined") return null;

      setError(null);
      setIsLoading(true);

      try {
        /* 1. Load ORT (browser only) */
        const ort = await import("onnxruntime-web");

        /* 2. WASM config — must be set BEFORE InferenceSession.create()
         *    wasmPaths: serve locally to satisfy COEP (require-corp blocks CDN)
         *    numThreads: 1 = single-thread mode, no SharedArrayBuffer needed   */
        ort.env.wasm.wasmPaths  = "/ort-wasm/";
        ort.env.wasm.numThreads = 1;

        /* 3. Create (or reuse) the InferenceSession */
        if (!sessionRef.current) {
          console.log("[OnnxRuntime] Preparing model:", MODEL_PATH);
          
          // Load from IndexedDB cache or fetch from network
          const modelBuffer = await fetchAndCacheModel(MODEL_PATH);

          sessionRef.current = await ort.InferenceSession.create(modelBuffer, {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "all",
          });

          setIsModelReady(true);
          console.log("[OnnxRuntime] inputNames :", sessionRef.current.inputNames);
          console.log("[OnnxRuntime] outputNames:", sessionRef.current.outputNames);
        }

        const session = sessionRef.current;

        /* 4. Build the input tensor [1, 3, 224, 224] */
        const tensorData  = canvasToTensor(canvas);
        const inputTensor = new ort.Tensor("float32", tensorData, [
          1, 3, INPUT_SIZE, INPUT_SIZE,
        ]);

        const feeds: Record<string, typeof inputTensor> = {
          [INPUT_NODE]: inputTensor,
        };

        /* 5. Run inference */
        const results = await session.run(feeds);
        console.log("[OnnxRuntime] Raw results:", results);

        /* 6. Parse denom_logits → [1, 7] → softmax → argmax */
        const denomData  = Array.from(results[DENOM_NODE].data as Float32Array);
        const denomProbs = softmax(denomData);
        const denomIdx   = denomProbs.indexOf(Math.max(...denomProbs));
        const denomination         = DENOMINATION_CLASSES[denomIdx] ?? `Class ${denomIdx}`;
        const denominationConfidence = denomProbs[denomIdx];

        /* 7. Parse auth_logits → [1] → sigmoid → ≥ 0.5 = Genuine
         *    The model uses BCEWithLogitsLoss, so the output is a raw logit.
         *    auth_logits.squeeze(-1) in forward() makes it shape [batch].
         *    For batch=1, results[AUTH_NODE].data has exactly 1 element.     */
        const authLogit       = (results[AUTH_NODE].data as Float32Array)[0];
        const authenticityScore = sigmoid(authLogit);  // → P(Genuine)
        const isGenuine         = authenticityScore >= 0.5;

        /* 8. Build debug rawOutputs */
        const rawOutputs: Record<string, number[]> = {
          [DENOM_NODE]: denomData,
          [AUTH_NODE]:  [authLogit],
        };

        console.log(
          `[OnnxRuntime] ${denomination} | conf=${denominationConfidence.toFixed(3)}` +
          ` | auth_logit=${authLogit.toFixed(3)} → ${isGenuine ? "Genuine" : "Fake"}` +
          ` (p=${authenticityScore.toFixed(3)})`
        );

        return {
          denomination,
          denominationIndex: denomIdx,
          denominationConfidence,
          isGenuine,
          authenticityScore,
          rawOutputs,
        };
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Inference failed — see browser console.";
        console.error("[OnnxRuntime] Error:", err);
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { isLoading, isModelReady, error, runInference };
}
