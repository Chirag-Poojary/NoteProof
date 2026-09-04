"use client";

/**
 * useNoteProofPipeline.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Master pipeline orchestrator for NoteProof's two-model architecture:
 *   Raw Frame → YOLO Detector → Gate → Crop with Padding → Classifier → Result
 *
 * Manages explicit PipelineState state machine transitions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from "react";
import type { PipelineState, ClassificationResult } from "./modelConfig";
import { useYoloDetector } from "./useYoloDetector";
import { useOnnx } from "./useOnnx";
import { cropWithPadding } from "./imagePipeline";
import { generateBoxedImageDataUrl } from "@/components/DetectionOverlay";

export interface UseNoteProofPipelineReturn {
  state: PipelineState;
  resetState: () => void;
  capture: (videoElement: HTMLVideoElement | null) => Promise<void>;
}

export function useNoteProofPipeline(): UseNoteProofPipelineReturn {
  const [state, setState] = useState<PipelineState>({ stage: "idle" });

  const { detect, detectorError } = useYoloDetector();
  const { runInference, error: classifierError } = useOnnx();

  const resetState = useCallback(() => {
    setState({ stage: "idle" });
  }, []);

  const capture = useCallback(
    async (videoElement: HTMLVideoElement | null) => {
      if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
        setState({ stage: "error", message: "Camera stream is not ready." });
        return;
      }

      try {
        // Step 1: Capture full raw video frame without pre-crop
        const rawCanvas = document.createElement("canvas");
        rawCanvas.width = videoElement.videoWidth;
        rawCanvas.height = videoElement.videoHeight;
        const ctx = rawCanvas.getContext("2d");
        if (!ctx) {
          setState({ stage: "error", message: "Failed to initialize capture canvas." });
          return;
        }
        ctx.drawImage(videoElement, 0, 0, rawCanvas.width, rawCanvas.height);

        // Step 2: Stage -> detecting
        setState({ stage: "detecting" });

        // Step 3: Run YOLO note detector
        const detection = await detect(rawCanvas);

        if (!detection.found || !detection.box) {
          console.log("[Pipeline] Detector found no note in frame.");
          setState({ stage: "not_found" });
          return;
        }

        // Step 4: Detection box found! Generate boxed preview image
        const boxedImage = generateBoxedImageDataUrl(rawCanvas, detection.box);
        setState({
          stage: "detected",
          box: detection.box,
          boxedImage,
        });

        // Step 5: Stage -> classifying
        setState({ stage: "classifying", boxedImage });

        // Step 6: Crop note region with PAD_FRAC (8%) padding to 224×224
        const croppedCanvas = cropWithPadding(rawCanvas, detection.box);

        // Step 7: Run EfficientNetB3 classifier
        const result = await runInference(croppedCanvas);

        if (!result) {
          setState({
            stage: "error",
            message: classifierError ?? detectorError ?? "Classification failed.",
          });
          return;
        }

        // Step 8: Done!
        setState({
          stage: "done",
          result,
          boxedImage,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Pipeline execution failed.";
        console.error("[Pipeline] Error:", err);
        setState({ stage: "error", message: msg });
      }
    },
    [detect, runInference, classifierError, detectorError]
  );

  return {
    state,
    resetState,
    capture,
  };
}
