"use client";

/**
 * useYoloDetector.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom React hook for running note_detector.onnx (YOLO26n) in-browser via ORT WASM.
 * Implements IndexedDB model caching via modelCache.ts and single-thread execution.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useRef, useState, useCallback } from "react";
import {
  DETECTOR_MODEL_PATH,
  DETECTOR_INPUT_SIZE,
  DETECTOR_CONF_THRESHOLD,
  type DetectionResult,
} from "./modelConfig";
import { fetchAndCacheModel } from "./modelCache";
import {
  letterbox,
  letterboxCanvasToTensor,
  parseDetectorOutput,
} from "./imagePipeline";

export interface UseYoloDetectorReturn {
  isDetecting: boolean;
  isDetectorReady: boolean;
  detectorError: string | null;
  detect: (sourceCanvas: HTMLCanvasElement) => Promise<DetectionResult>;
}

export function useYoloDetector(): UseYoloDetectorReturn {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isDetectorReady, setIsDetectorReady] = useState(false);
  const [detectorError, setDetectorError] = useState<string | null>(null);

  const detect = useCallback(
    async (sourceCanvas: HTMLCanvasElement): Promise<DetectionResult> => {
      if (typeof window === "undefined") {
        return { found: false, box: null };
      }

      setDetectorError(null);
      setIsDetecting(true);

      try {
        /* 1. Import ORT (browser only) */
        const ort = await import("onnxruntime-web");

        /* 2. WASM configuration */
        ort.env.wasm.wasmPaths = "/ort-wasm/";
        ort.env.wasm.numThreads = 1;

        /* 3. Lazy session initialization */
        if (!sessionRef.current) {
          console.log("[YoloDetector] Loading model:", DETECTOR_MODEL_PATH);
          const modelBuffer = await fetchAndCacheModel(DETECTOR_MODEL_PATH);

          sessionRef.current = await ort.InferenceSession.create(modelBuffer, {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "all",
          });

          setIsDetectorReady(true);
          console.log("[YoloDetector] inputNames :", sessionRef.current.inputNames);
          console.log("[YoloDetector] outputNames:", sessionRef.current.outputNames);
        }

        const session = sessionRef.current;
        const inputNodeName = session.inputNames[0] ?? "images";

        /* 4. Preprocess: Letterbox to 640×640 */
        const origWidth = sourceCanvas.width;
        const origHeight = sourceCanvas.height;

        const letterboxRes = letterbox(
          sourceCanvas,
          origWidth,
          origHeight,
          DETECTOR_INPUT_SIZE
        );

        /* 5. Convert to tensor Float32Array [1, 3, 640, 640] */
        const tensorData = letterboxCanvasToTensor(letterboxRes.canvas);
        const inputTensor = new ort.Tensor("float32", tensorData, [
          1,
          3,
          DETECTOR_INPUT_SIZE,
          DETECTOR_INPUT_SIZE,
        ]);

        const feeds: Record<string, typeof inputTensor> = {
          [inputNodeName]: inputTensor,
        };

        /* 6. Run YOLO detector inference */
        const results = await session.run(feeds);
        const outputNodeName = session.outputNames[0];
        const outputTensor = results[outputNodeName];

        const outputData = outputTensor.data as Float32Array;
        const shape = outputTensor.dims as readonly number[];

        /* 7. Parse detection boxes */
        const detectionResult = parseDetectorOutput(
          outputData,
          shape,
          letterboxRes.scale,
          letterboxRes.padX,
          letterboxRes.padY,
          origWidth,
          origHeight,
          DETECTOR_CONF_THRESHOLD
        );

        console.log(
          `[YoloDetector] Detection result: found=${detectionResult.found}`,
          detectionResult.box
        );

        return detectionResult;
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Detector failed — see browser console.";
        console.error("[YoloDetector] Error:", err);
        setDetectorError(msg);
        return { found: false, box: null };
      } finally {
        setIsDetecting(false);
      }
    },
    []
  );

  return {
    isDetecting,
    isDetectorReady,
    detectorError,
    detect,
  };
}
