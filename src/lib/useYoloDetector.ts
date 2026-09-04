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
  isInitializingDetector: boolean;
  detectorError: string | null;
  initDetector: () => Promise<void>;
  detect: (sourceCanvas: HTMLCanvasElement) => Promise<DetectionResult>;
}

export function useYoloDetector(): UseYoloDetectorReturn {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isDetectorReady, setIsDetectorReady] = useState(false);
  const [isInitializingDetector, setIsInitializingDetector] = useState(false);
  const [detectorError, setDetectorError] = useState<string | null>(null);

  const initDetector = useCallback(async () => {
    if (typeof window === "undefined" || sessionRef.current) {
      if (sessionRef.current) setIsDetectorReady(true);
      return;
    }

    setIsInitializingDetector(true);
    setDetectorError(null);

    try {
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = "/ort-wasm/";
      ort.env.wasm.numThreads = 1;

      console.log("[YoloDetector] Pre-loading model session:", DETECTOR_MODEL_PATH);
      const modelBuffer = await fetchAndCacheModel(DETECTOR_MODEL_PATH);

      sessionRef.current = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });

      setIsDetectorReady(true);
      console.log("[YoloDetector] Detector session ready. Input names:", sessionRef.current.inputNames);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to initialize YOLO detector.";
      console.error("[YoloDetector] Init error:", err);
      setDetectorError(msg);
    } finally {
      setIsInitializingDetector(false);
    }
  }, []);

  const detect = useCallback(
    async (sourceCanvas: HTMLCanvasElement): Promise<DetectionResult> => {
      if (typeof window === "undefined") {
        return { found: false, box: null };
      }

      setDetectorError(null);
      setIsDetecting(true);

      try {
        const ort = await import("onnxruntime-web");
        ort.env.wasm.wasmPaths = "/ort-wasm/";
        ort.env.wasm.numThreads = 1;

        if (!sessionRef.current) {
          await initDetector();
        }

        const session = sessionRef.current;
        if (!session) {
          throw new Error("YOLO Detector session is not initialized.");
        }

        const inputNodeName = session.inputNames[0] ?? "images";

        // Preprocess: Letterbox to 640×640
        const origWidth = sourceCanvas.width;
        const origHeight = sourceCanvas.height;

        const letterboxRes = letterbox(
          sourceCanvas,
          origWidth,
          origHeight,
          DETECTOR_INPUT_SIZE
        );

        // Convert to tensor Float32Array [1, 3, 640, 640]
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

        // Run YOLO detector inference
        const results = await session.run(feeds);
        const outputNodeName = session.outputNames[0];
        const outputTensor = results[outputNodeName];

        const outputData = outputTensor.data as Float32Array;
        const shape = outputTensor.dims as readonly number[];

        // Parse detection boxes
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
    [initDetector]
  );

  return {
    isDetecting,
    isDetectorReady,
    isInitializingDetector,
    detectorError,
    initDetector,
    detect,
  };
}
