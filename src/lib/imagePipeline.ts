/**
 * imagePipeline.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Preprocessing, coordinate transformation, bounding box un-letterboxing,
 * and padded cropping utilities for NoteProof two-model architecture.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  DETECTOR_INPUT_SIZE,
  INPUT_SIZE,
  PAD_FRAC,
  type DetectionBox,
  type DetectionResult,
} from "./modelConfig";

export interface LetterboxResult {
  canvas: HTMLCanvasElement;
  scale: number;
  padX: number;
  padY: number;
  origWidth: number;
  origHeight: number;
}

/**
 * Resizes source image/video into a 640×640 letterboxed canvas pre-filled with
 * YOLO standard background color rgb(114, 114, 114).
 */
export function letterbox(
  source: HTMLCanvasElement | HTMLVideoElement | CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetSize: number = DETECTOR_INPUT_SIZE
): LetterboxResult {
  const scale = Math.min(targetSize / sourceWidth, targetSize / sourceHeight);
  const newW = Math.round(sourceWidth * scale);
  const newH = Math.round(sourceHeight * scale);
  const padX = (targetSize - newW) / 2;
  const padY = (targetSize - newH) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Standard YOLO letterbox pad color
    ctx.fillStyle = "rgb(114, 114, 114)";
    ctx.fillRect(0, 0, targetSize, targetSize);
    ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight, padX, padY, newW, newH);
  }

  return {
    canvas,
    scale,
    padX,
    padY,
    origWidth: sourceWidth,
    origHeight: sourceHeight,
  };
}

/**
 * Converts a 640×640 letterbox canvas to Float32Array tensor in CHW layout [1, 3, 640, 640].
 * Pixel values normalized to [0, 1].
 */
export function letterboxCanvasToTensor(canvas: HTMLCanvasElement): Float32Array {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context from letterbox canvas");

  const width = canvas.width;
  const height = canvas.height;
  const { data } = ctx.getImageData(0, 0, width, height);

  const ch = width * height;
  const tensor = new Float32Array(3 * ch);

  for (let i = 0; i < ch; i++) {
    tensor[i]          = data[i * 4]     / 255.0; // R
    tensor[ch + i]     = data[i * 4 + 1] / 255.0; // G
    tensor[2 * ch + i] = data[i * 4 + 2] / 255.0; // B
  }

  return tensor;
}

/**
 * Parses YOLO26 ONNX detection output tensor shape [1, 300, 6] or [300, 6].
 * Each row: [x1, y1, x2, y2, confidence, class].
 * Filters by confidence >= confThreshold and maps coordinates back to original frame space.
 * Returns single highest-confidence DetectionResult.
 */
export function parseDetectorOutput(
  outputData: Float32Array,
  shape: readonly number[],
  scale: number,
  padX: number,
  padY: number,
  origWidth: number,
  origHeight: number,
  confThreshold: number
): DetectionResult {
  // Determine number of detection rows (typically 300 for YOLO exports)
  let numDetections = 300;
  let stride = 6;

  if (shape.length === 3 && shape[0] === 1) {
    numDetections = shape[1];
    stride = shape[2];
  } else if (shape.length === 2) {
    numDetections = shape[0];
    stride = shape[1];
  }

  let bestBox: DetectionBox | null = null;
  let highestConf = -1;

  for (let i = 0; i < numDetections; i++) {
    const offset = i * stride;
    const x1 = outputData[offset];
    const y1 = outputData[offset + 1];
    const x2 = outputData[offset + 2];
    const y2 = outputData[offset + 3];
    const confidence = outputData[offset + 4];

    if (confidence >= confThreshold && confidence > highestConf) {
      // Un-letterbox back to original image space
      const origX1 = Math.max(0, Math.min(origWidth, (x1 - padX) / scale));
      const origY1 = Math.max(0, Math.min(origHeight, (y1 - padY) / scale));
      const origX2 = Math.max(0, Math.min(origWidth, (x2 - padX) / scale));
      const origY2 = Math.max(0, Math.min(origHeight, (y2 - padY) / scale));

      const w = origX2 - origX1;
      const h = origY2 - origY1;

      if (w > 0 && h > 0) {
        highestConf = confidence;
        bestBox = {
          x: origX1,
          y: origY1,
          w,
          h,
          confidence,
        };
      }
    }
  }

  return {
    found: bestBox !== null,
    box: bestBox,
  };
}

/**
 * Takes the original captured image/canvas and crops around DetectionBox padded by padFrac (0.08).
 * Resizes the crop to targetSize × targetSize (default 224×224 for classifier).
 */
export function cropWithPadding(
  sourceCanvas: HTMLCanvasElement,
  box: DetectionBox,
  padFrac: number = PAD_FRAC,
  targetSize: number = INPUT_SIZE
): HTMLCanvasElement {
  const origWidth = sourceCanvas.width;
  const origHeight = sourceCanvas.height;

  const padW = box.w * padFrac;
  const padH = box.h * padFrac;

  const cropX = Math.max(0, box.x - padW);
  const cropY = Math.max(0, box.y - padH);
  const cropW = Math.min(origWidth - cropX, box.w + 2 * padW);
  const cropH = Math.min(origHeight - cropY, box.h + 2 * padH);

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = targetSize;
  cropCanvas.height = targetSize;

  const ctx = cropCanvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(
      sourceCanvas,
      cropX,
      cropY,
      cropW,
      cropH,
      0,
      0,
      targetSize,
      targetSize
    );
  }

  return cropCanvas;
}
