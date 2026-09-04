# NoteProof — Two-Model Architecture Implementation Plan
### For an AI coding agent restructuring github.com/Chirag-Poojary/NoteProof

This plan was written against the actual current contents of the repository (cloned and
read directly, not assumed) and against the two model files already sitting locally at
`public/models/note_detector.onnx` (YOLO26n) and `public/models/currency_multitask.onnx`
(EfficientNetB3) — both trained, both untracked in git as of this writing. The agent's job
is integration, not training.

---

## 0. Non-negotiable architectural constraints

Read this section before touching anything else — several of the section headings below
map onto a generic client-server template, and this project is deliberately **not** that.

- **No backend server, no REST API, no database.** Both models run entirely in the
  browser via `onnxruntime-web` (already a dependency, v1.27.0). Every "endpoint" and
  "request/response" in this plan is a TypeScript function signature or React state
  shape *inside the Next.js app* — never a network call.
- **Everything downloads to the user's device once, then runs offline.** This is already
  partially implemented (see §1) — the plan extends it, not invents it.
- **Two models, sequential dependency.** The classifier's input *is* the detector's
  output (a crop). They cannot run in parallel with each other; they can only be made to
  not block the UI thread while running.
- **Stack stays as-is**: Next.js 16, React 19, TypeScript, Tailwind, no new frameworks.

---

## 1. Current repository analysis

| File | Current responsibility | Status |
|---|---|---|
| `src/app/page.tsx` | Owns all top-level state; `handleCapture` does a naive centre-square crop to 224×224, then calls the classifier directly | **Has the crop bug** (see below) |
| `src/lib/useCamera.ts` | Camera lifecycle (`getUserMedia`, start/stop); `captureFrame()` does an **identical, duplicate** centre-crop | Currently **dead code** — `page.tsx` never calls it, it re-implements the same logic inline |
| `src/lib/useOnnx.ts` | Classifier-only inference hook. Already implements: IndexedDB model caching (`fetchAndCacheModel`), single-threaded WASM config (`numThreads = 1`, local `wasmPaths`), named input/output nodes, softmax/sigmoid parsing | Solid pattern — **reuse its structure for the detector hook**, don't reinvent it |
| `src/lib/modelConfig.ts` | Constants + `InferenceResult` type | `MODEL_PATH` currently points to `currency_multitask_edge_inline.onnx` — **stale**, the working file is now named `currency_multitask.onnx` (see §10, Phase A) |
| `src/components/ResultModal.tsx` | Bottom-sheet showing denomination + Genuine/Fake chip + confidence bars | No "Uncertain" state exists yet; takes a raw `thumbnail`, not a boxed image |
| `src/components/CameraViewfinder.tsx` | Renders the video element + a decorative CSS reticle overlay | Reticle is **not** wired to the actual crop region — cosmetic only, leave as-is |
| `src/components/CameraSplash.tsx`, `CaptureButton.tsx`, `ErrorToast.tsx` | Splash screen, capture button, toast notifications | No changes needed — reusable as-is |
| `public/models/` (committed) | `currency_multitask_edge_inline.onnx` only | Local working copy additionally has `note_detector.onnx` and a renamed `currency_multitask.onnx`, both untracked |
| `public/ort-wasm/` | WASM runtime binaries (threaded build present, but used in **single-thread mode** — see §8) | Reuse as-is, do not swap builds |

**The crop bug**, for context the agent needs: `handleCapture` in `page.tsx` takes the
raw camera frame and crops the largest centered square out of it, then resizes to
224×224 — regardless of where in frame the note actually is. This is precisely the
defect this whole restructuring replaces: the detector's bounding box becomes the crop
region instead.

---

## 2. Modular restructuring plan

New/changed files:

```
src/lib/
  modelConfig.ts        (EXTEND — add detector constants)
  modelCache.ts          (NEW — IndexedDB caching, factored out of useOnnx.ts, shared by both hooks)
  imagePipeline.ts        (NEW — letterbox, un-letterbox, crop-with-padding, canvas helpers)
  useYoloDetector.ts       (NEW — detector inference hook, mirrors useOnnx.ts's structure)
  useOnnx.ts                (KEEP — classifier hook, unchanged internals, reuses modelCache.ts)
  useNoteProofPipeline.ts    (NEW — orchestration layer: owns the full capture→detect→gate→crop→classify→gate flow)
  useCamera.ts                (MODIFY — captureFrame returns the raw full frame, no pre-crop)
src/components/
  DetectionOverlay.tsx          (NEW — renders the boxed preview image)
  ResultModal.tsx                (MODIFY — add Uncertain state, accept boxed preview image)
src/app/
  page.tsx                        (MODIFY — becomes thin, delegates to useNoteProofPipeline)
```

`modelCache.ts` exists because `useOnnx.ts` already solved IndexedDB model caching well —
duplicating that logic into a second hook for the detector would be the kind of drift this
project has already been bitten by more than once. Extract it once, parameterize by model
URL, use it from both hooks.

---

## 3. Internal interface ("API") redesign

No network boundary exists, so this section defines the **TypeScript contract between
pipeline stages** instead. This replaces today's single `isLoading: boolean` with an
explicit state machine — the thing `page.tsx` and `ResultModal` key their rendering off of.

```typescript
// src/lib/modelConfig.ts additions

export interface DetectionBox {
  x: number; y: number; w: number; h: number; // pixel coords in the ORIGINAL captured frame
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
  authStatus: AuthStatus;          // replaces the old boolean isGenuine
  authenticityScore: number;
  rawOutputs: Record<string, number[]>;
}

export type PipelineState =
  | { stage: "idle" }
  | { stage: "detecting" }
  | { stage: "not_found" }                                   // detector found nothing — show retake prompt
  | { stage: "detected"; box: DetectionBox; boxedImage: string } // boxed preview ready to show
  | { stage: "classifying"; boxedImage: string }
  | { stage: "done"; result: ClassificationResult; boxedImage: string }
  | { stage: "error"; message: string };
```

`useNoteProofPipeline.ts` owns a single `PipelineState` and exposes one function,
`capture(): Promise<void>`, that walks it through every transition above. `page.tsx` and
`ResultModal` just render off `state.stage` — no other component needs to know inference
is happening in two steps.

---

## 4. Frontend modification requirements

- **`DetectionOverlay.tsx` (new)** — takes the full-resolution captured frame + a
  `DetectionBox`, draws the frame to a canvas at its native size, strokes a rectangle
  over the box (distinct color, ~3px width, matches the app's accent color), and returns
  a `toDataURL()` string. This is what satisfies "annotated image with bounding boxes
  must be displayed to the user for visual confirmation" — it's the `state.stage ===
  "detected"` view, shown *before* classification starts, not folded into the final
  result screen.
- **`page.tsx`** — replace `handleCapture`'s inline crop+infer logic with a call into
  `useNoteProofPipeline().capture()`. Render branches on `state.stage`:
  - `"detecting"` → spinner with "Detecting note…"
  - `"not_found"` → reuse `ErrorToast` with "No note detected — please retake"
  - `"detected"` → show `DetectionOverlay`'s boxed image briefly (this is the visual
    confirmation step), then auto-advance to classifying
  - `"classifying"` → spinner with "Reading note…", boxed image still visible in background
  - `"done"` → open `ResultModal` as today
  - `"error"` → `ErrorToast` with `state.message`
- **`ResultModal.tsx`** — rename the `thumbnail` prop to `previewImage` (now the *boxed*
  image, not a naive crop) and add a third chip variant:
  ```tsx
  authStatus === "uncertain"
    ? <div className="authenticity-chip authenticity-chip--uncertain">
        <span className="authenticity-chip__dot" />
        Uncertain — retake in better light
      </div>
    : /* existing genuine/fake chip, unchanged */
  ```
  Add the corresponding `.authenticity-chip--uncertain` CSS rule alongside the existing
  `--genuine`/`--fake` ones (same file/pattern the styling already lives in).

---

## 5. Image pipeline specification

**Detector preprocessing (letterbox to 640×640):**
```
scale = min(640 / frameWidth, 640 / frameHeight)
newW, newH = round(frameWidth * scale), round(frameHeight * scale)
padX, padY = (640 - newW) / 2, (640 - newH) / 2
```
Draw the resized frame centered in a 640×640 canvas pre-filled with `rgb(114,114,114)`
(the standard YOLO letterbox pad color — matters for matching training-time preprocessing,
not arbitrary). Store `{scale, padX, padY}` — needed to map boxes back afterward.

**Detector output parsing:** confirmed from this model's own export log —
output tensor shape **`(1, 300, 6)`**, each row `[x1, y1, x2, y2, confidence, class]` in
**640×640 letterbox space**, already NMS-deduplicated by the model itself (YOLO26 is
NMS-free — do not write a manual NMS pass, it's redundant and would only introduce a new
bug). Filter rows by `confidence >= DETECTOR_CONF_THRESHOLD`; single class, so `class`
is always `0`.

**Un-letterbox** the winning box back to the original captured-frame coordinates:
```
origX1 = (x1 - padX) / scale
origY1 = (y1 - padY) / scale
// same for x2, y2
```

**Multi-note policy (v1 decision — document, don't silently pick one):** process only
the **single highest-confidence** detection per capture. The types in §3 are already
shaped so this is a low-friction future extension — `DetectionResult` could hold
`boxes: DetectionBox[]` instead of one `box`, and the orchestrator loop over them — but
implement the single-box path first; don't build multi-note UI speculatively.

**Classifier crop:** pad the winning box by `PAD_FRAC = 0.08` on each side before
cropping (same constant, same reasoning, as the training-time crop in
`build_datasets.py` — **training and inference padding must match**, this project has
already hit this exact class of bug once with the naive centre-crop; don't reintroduce
a variant of it here with a mismatched padding constant).

**Classifier preprocessing:** unchanged — `canvasToTensor` in `useOnnx.ts` already
correctly implements `Resize(224,224) → ImageNet normalize → CHW`. Feed it the padded
crop canvas instead of the naive-crop canvas; no changes to the function itself.

---

## 6. Model integration details

- **Verify node names before hardcoding them.** `modelConfig.ts` already documents this
  discipline for the classifier ("open DevTools console... update to match your model")
  — follow the same pattern for the detector: log `session.inputNames` /
  `session.outputNames` on first load and confirm against Ultralytics' default (`images`
  in, single detection output out) before assuming.
- **`DETECTOR_CONF_THRESHOLD`**: start at `0.5`, tune against real captures.
- **`AUTH_UNCERTAIN_BAND`**: `[0.35, 0.65]` on the sigmoid authenticity score — inside
  this band, report `authStatus: "uncertain"` rather than forcing genuine/fake.
- **No detection** → `PipelineState` goes straight to `"not_found"`; the classifier is
  never invoked.
- **Non-currency object detected anyway** (a false positive slipping past the detector's
  negative-class training): no special-case handling needed for v1 — the classifier's
  own denomination softmax will typically be low-confidence on genuinely out-of-
  distribution crops. Optional future hardening: also gate on
  `denominationConfidence` the same way authenticity is gated, but that's an
  enhancement, not a blocker for this restructuring.

---

## 7. Caching strategy

No database, by design — there's no server to hold one, and no user accounts, so there's
nothing to key it against. State is:

- **Model weights** — extend the existing IndexedDB caching (`fetchAndCacheModel`,
  currently classifier-only) into shared `modelCache.ts`, keyed by model URL, used by
  both `useOnnx.ts` and `useYoloDetector.ts`. This is what delivers "slow first time,
  instant after" for *both* models, not just one.
- **Inference sessions** — created once per hook via `useRef`, reused across every
  capture in the tab session (already the classifier's pattern; mirror it exactly for
  the detector).
- **Captured images / results** — intentionally *not* persisted anywhere. Discarded on
  reload. This is a feature (privacy), not a gap to fill.

---

## 8. Deployment considerations

- **Download size**: `note_detector.onnx` ≈ 9.4 MB, `currency_multitask.onnx` ≈ 48 MB —
  roughly 57–58 MB combined on first visit. Show a first-load progress indicator; this
  is the "takes some time at the beginning" the project's design already accounts for.
- **Static asset caching**: confirm Vercel's default long-lived caching for `/public`
  actually applies to files this large — spot-check response headers on deploy rather
  than assuming.
- **Memory**: don't eagerly create both `InferenceSession`s at page load. Create the
  detector session immediately (camera UI needs to be interactive fast); defer creating
  the classifier session until the first successful detection. Reduces peak WASM memory
  and first-paint time, at zero cost to the actual pipeline (classifier isn't needed
  until a detection succeeds anyway).
- **Sync vs. async**: both `session.run()` calls are inherently async/Promise-based; the
  two stages are inherently *sequential*, not parallelizable (classifier needs the
  detector's crop) — the only real async concern is keeping the UI responsive during
  each `await`, which §4's explicit per-stage loading states already cover.
- **Do not switch to threaded WASM.** `numThreads = 1` and local `wasmPaths` were
  deliberately chosen to avoid needing `SharedArrayBuffer` and the COOP/COEP header
  configuration that requires on Vercel. The threaded build's `.mjs`/`.wasm` files are
  present in `public/ort-wasm/` but unused on purpose — leave `numThreads = 1` in the new
  detector hook too, for consistency and to avoid silently breaking the existing setup.

---

## 9. Testing strategy

| Input condition | Expected `PipelineState` path | Notes |
|---|---|---|
| Genuine note, clean, flat | detecting → detected → classifying → done (genuine) | Baseline happy path |
| Genuine note, angled / glare | detecting → detected → classifying → done (genuine **or** uncertain) | Should never land on confident "fake" |
| Fake/simulated note, clean | detecting → detected → classifying → done (fake) | |
| Multiple notes in frame | detecting → detected (highest-confidence box only) → ... | Confirm it doesn't silently pick a *low*-confidence box |
| Partially cut-off note | detecting → detected or not_found | Acceptable either way — document which |
| Face / hand / chair | detecting → not_found (ideally) | If it fires anyway, classifier should show low confidence, not a confident wrong verdict |
| Empty background | detecting → not_found | |
| Poor lighting | detecting → detected → classifying → done (uncertain likely) | |

Prioritize **unit tests for the pure coordinate-math functions** in `imagePipeline.ts`
(letterbox scale/pad calculation, un-letterbox mapping, padded-crop bounds) over
end-to-end tests — this class of bug (a training/inference preprocessing mismatch) is
exactly what has caused every major issue in this project so far, and it's cheap to
catch with a plain input/output assertion before it ever reaches a device.

---

## 10. Phased rollout plan

1. **Phase A — fix the stale `MODEL_PATH` immediately.** Independent one-line fix,
   currently broken regardless of this restructuring, zero risk. Do this first.
2. **Phase B — detector in isolation.** Build `useYoloDetector.ts`, `imagePipeline.ts`'s
   letterbox/un-letterbox functions, and `DetectionOverlay.tsx`. Wire *only* detection
   into a temporary debug path in `page.tsx` that stops at the boxed-image view — no
   classifier call yet. Validate on a real phone against genuine notes and non-note
   objects before proceeding. This directly satisfies validating YOLO independently
   before connecting EfficientNet.
3. **Phase C — connect the classifier.** Add the padded-crop step, wire the existing
   `useOnnx.ts` to receive the detector's crop instead of the naive one.
4. **Phase D — uncertainty gating + `ResultModal` updates.** Add the "Uncertain" chip
   and band logic.
5. **Phase E — delete dead code.** Remove the duplicate naive-crop logic from both
   `useCamera.ts`'s `captureFrame` (already unused) and the old inline version in
   `page.tsx` once `useNoteProofPipeline.ts` fully replaces it.
6. **Phase F — polish.** Loading copy, disclaimer text, first-load download-progress UI.

**Process**: do this on a feature branch (e.g. `feature/two-stage-detection`), merge to
`main` only after Phase B and C are manually validated on-device. Rollback is a plain
`git revert` / Vercel's built-in previous-deployment rollback — there's no live user base
or feature-flag infrastructure to build here; matching the process to the project's
actual scale matters more than pre-building enterprise machinery it doesn't need yet.

---

## Dependencies

No new npm packages required — `onnxruntime-web` (already installed) runs both ONNX
files identically; there's no separate library needed per model. The one thing to
verify on first integration, not assume: that the YOLO26 ONNX export uses only ops
`onnxruntime-web`'s WASM execution provider supports. It's a standard CNN detection
head and should be fine, but confirm on first load rather than discovering it in
production.
