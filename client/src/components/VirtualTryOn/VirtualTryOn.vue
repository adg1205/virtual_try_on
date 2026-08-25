<template>
  <div class="virtual-tryon-root">
    <div v-if="savedTryOn && savedTryOn.id" class="alert alert-info border-0 rounded-4 mb-3 tryon-restored-banner">
      Saved look settings restored. Choose Live Mirror, Camera, or Upload Photo to reuse this frame, lens, and fit.
    </div>
    <!-- TOP STAGE HEADER: CURRENT FRAME & CONTROLS -->
    <div class="tryon-stage-header glass-panel mb-3 p-3 rounded-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
      <div class="d-flex align-items-center gap-3">
        <div class="tryon-frame-thumb-sm">
          <img :src="currentFrame.image_url" :alt="currentFrame.name" class="img-fluid" @error="handleImgError" />
        </div>
        <div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-primary rounded-pill px-2 py-1 small">Currently Trying On</span>
            <h3 class="fs-6 font-weight-700 text-white mb-0">{{ currentFrame.name || 'Select a Frame' }}</h3>
          </div>
          <span class="small text-muted-custom">
            {{ currentFrame.brand || 'Optical Collection' }}
            <template v-if="currentFrame.price"> • ৳{{ Number(currentFrame.price).toFixed(2) }}</template>
            <template v-if="currentFrame.shape"> • {{ currentFrame.shape }}</template>
          </span>
        </div>
      </div>

      <div class="d-flex align-items-center gap-2">
        <a href="/customer/frame-catalog" class="btn btn-secondary btn-sm rounded-pill px-3">
          👓 Browse Catalog
        </a>
      </div>
    </div>

    <!-- MAIN VIEWPORT STAGE -->
    <div class="tryon-viewport-container glass-panel rounded-4 position-relative overflow-hidden">
      <!-- 1. LANDING DEFAULT STATE: 3 OPTIONS -->
      <div v-if="viewMode === 'landing'" class="tryon-stage-landing d-flex flex-column align-items-center justify-content-center p-4 text-center w-100 h-100">
        <div class="fs-1 mb-2">📸</div>
        <h3 class="fs-4 font-weight-800 text-white mb-1">Virtual Try-On Studio</h3>
        <p class="small text-muted-custom mb-4" style="max-width: 460px; line-height: 1.6;">
          Experience how frames look on your face in real-time with 3D face tracking, capture a photo snapshot, or upload an existing portrait.
        </p>

        <!-- 3 Primary Action Buttons -->
        <div class="d-flex flex-wrap justify-content-center gap-3 mb-3">
          <button
            type="button"
            class="btn btn-primary rounded-pill px-4 py-2 font-weight-700 shadow-lg d-inline-flex align-items-center gap-2"
            @click="enterLiveMirror"
          >
            <span>🪞</span> Start Live Mirror
          </button>

          <button
            type="button"
            class="btn btn-secondary rounded-pill px-4 py-2 font-weight-700 d-inline-flex align-items-center gap-2"
            @click="enterCameraCapture"
          >
            <span>📷</span> Use Camera
          </button>

          <button
            type="button"
            class="btn btn-secondary rounded-pill px-4 py-2 font-weight-700 d-inline-flex align-items-center gap-2"
            @click="triggerFileInput"
          >
            <span>📁</span> Upload Photo
          </button>

          <input
            ref="fileInputEl"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="d-none"
            @change="handleFileUpload"
          />
        </div>

        <p v-if="uploadError" class="tryon-upload-error small mb-2" role="alert">
          ⚠️ {{ uploadError }}
        </p>
        <p v-else class="small text-muted-custom mb-2">
          JPG, PNG, or WebP · up to 6 MB
        </p>

        <div class="model-status-indicator mt-2 small">
          <span v-if="modelLoading" class="text-warning">⏳ Loading AI Face Detection model...</span>
          <span v-else class="text-success">✅ AI 3D Face Tracking Ready</span>
        </div>
      </div>

      <!-- 2. LIVE MIRROR MODE (Dynamic AR Tracker) -->
      <div v-show="viewMode === 'live-mirror'" class="tryon-stage-live position-relative w-100 h-100">
        <video
          ref="videoEl"
          class="tryon-video-feed"
          autoplay
          playsinline
          muted
        ></video>

        <canvas ref="canvasEl" class="tryon-canvas-feed"></canvas>

        <!-- Live Mirror HUD -->
        <div class="tryon-live-hud">
          <div class="tryon-hud-badge">
            <span class="hud-status-dot" :class="{ 'hud-active': isTracking }"></span>
            {{ isTracking ? '3D Face Tracking Active' : (cameraLoading ? 'Starting Camera...' : 'Face Tracking Standby') }}
          </div>

          <div v-if="detectedShape" class="tryon-hud-shape-badge">
            📐 {{ detectedShape }} Face Shape (Calibrated)
          </div>
        </div>

        <!-- Live Controls -->
        <div class="tryon-viewport-controls">
          <button
            type="button"
            class="btn btn-primary rounded-pill px-4 py-2 font-weight-700 shadow-lg d-inline-flex align-items-center gap-2"
            :disabled="!isStreaming"
            @click="captureSnapshotFromLive"
          >
            <span>📸</span> Capture This Look
          </button>

          <button
            type="button"
            class="btn btn-secondary rounded-pill px-3 py-2 small"
            @click="toggleCameraFacing"
          >
            🔄 Flip
          </button>

          <button
            type="button"
            class="btn btn-secondary rounded-pill px-3 py-2 small"
            @click="returnToLanding"
          >
            ❌ Exit Mirror
          </button>
        </div>
      </div>

      <!-- 3. CAMERA CAPTURE MODE (Still Photo Taking) -->
      <div v-show="viewMode === 'camera-capture'" class="tryon-stage-camera position-relative w-100 h-100">
        <video
          ref="captureVideoEl"
          class="tryon-video-feed"
          autoplay
          playsinline
          muted
        ></video>

        <div class="tryon-viewport-controls">
          <button
            type="button"
            class="btn btn-primary rounded-pill px-4 py-2 font-weight-700 shadow-lg d-inline-flex align-items-center gap-2"
            @click="takeStillPhoto"
          >
            <span>📸</span> Capture Photo
          </button>

          <button
            type="button"
            class="btn btn-secondary rounded-pill px-3 py-2 small"
            @click="returnToLanding"
          >
            ❌ Cancel
          </button>
        </div>
      </div>

      <!-- 4. PHOTO RESULT / SNAPSHOT VIEWPORT -->
      <div v-show="viewMode === 'photo-result'" class="tryon-stage-photo position-relative w-100 h-100 d-flex flex-column align-items-center justify-content-center p-3">
        <div class="tryon-photo-result-wrapper position-relative text-center">
          <canvas ref="photoCanvasEl" class="tryon-composite-canvas rounded-3"></canvas>
        </div>

        <div class="tryon-viewport-controls">
          <button
            type="button"
            class="btn btn-success rounded-pill px-4 py-2 font-weight-700 d-inline-flex align-items-center gap-2"
            :disabled="isSaving"
            @click="saveSnapshotToHistory"
          >
            <span>💾</span> {{ isSaving ? 'Saving...' : 'Save to History' }}
          </button>

          <button
            type="button"
            class="btn btn-secondary rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2"
            @click="downloadSnapshot"
          >
            <span>⬇️</span> Download
          </button>

          <button
            type="button"
            class="btn btn-secondary rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2"
            @click="returnToLanding"
          >
            <span>🔄</span> Retake / New Look
          </button>
        </div>
      </div>

      <!-- Camera Error Banner -->
      <div v-if="cameraError" class="tryon-camera-error-banner p-4 text-center">
        <div class="fs-1 mb-2">📷</div>
        <h4 class="fs-6 text-danger font-weight-700">Camera Access Notice</h4>
        <p class="small text-white-50 mb-3">{{ cameraError }}</p>
        <button class="btn btn-secondary btn-sm rounded-pill px-3" @click="returnToLanding">
          Return to Studio
        </button>
      </div>
    </div>

    <!-- LOWER CONTROLS: FRAME SELECTOR CAROUSEL & TINT SWATCHES -->
    <div class="glass-panel p-3 rounded-4 mt-3">
      <div class="row g-3 align-items-center">
        <!-- Frame Carousel -->
        <div class="col-12 col-lg-8">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="small font-weight-700 text-uppercase text-muted-custom">Switch Frame</span>
            <span class="small text-info">{{ catalogFrames.length }} Styles Available</span>
          </div>
          <div class="tryon-frames-carousel d-flex gap-2 overflow-x-auto pb-1">
            <div
              v-for="f in catalogFrames"
              :key="f.id"
              :class="['tryon-frame-card', { active: currentFrame.id === f.id }]"
              @click="switchFrame(f)"
            >
              <div class="tryon-frame-card-img">
                <img :src="f.image_url" :alt="f.name" class="img-fluid" @error="handleImgError" />
              </div>
              <span class="tryon-frame-card-name text-truncate d-block">{{ f.name }}</span>
            </div>
          </div>
        </div>

        <!-- Tint Swatches -->
        <div class="col-12 col-lg-4">
          <span class="small font-weight-700 text-uppercase text-muted-custom d-block mb-2">Lens Tint</span>
          <div class="d-flex gap-2 flex-wrap">
            <button
              v-for="t in availableTints"
              :key="t.id"
              type="button"
              :class="['tint-swatch', { active: activeTintId === t.id }]"
              :style="{ background: t.colorHex }"
              :title="t.name"
              @click="setTint(t)"
            >
              <span class="swatch-icon">{{ t.icon }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="tryon-adjustment-panel mt-3 pt-3 border-top border-secondary border-opacity-25">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="small font-weight-700 text-uppercase text-muted-custom">Adjust Frame Fit</span>
          <button type="button" class="btn btn-link btn-sm text-info p-0" @click="resetOverlaySettings">Reset</button>
        </div>
        <div class="row g-3">
          <label class="col-12 col-md-6 col-xl-3 small text-white-50">
            Size {{ Math.round(overlayScale * 100) }}%
            <input v-model.number="overlayScale" type="range" min="0.75" max="1.35" step="0.01" class="form-range" @input="handleOverlayAdjustment" />
          </label>
          <label class="col-12 col-md-6 col-xl-3 small text-white-50">
            Horizontal {{ Math.round(overlayOffsetX * 100) }}%
            <input v-model.number="overlayOffsetX" type="range" min="-0.2" max="0.2" step="0.005" class="form-range" @input="handleOverlayAdjustment" />
          </label>
          <label class="col-12 col-md-6 col-xl-3 small text-white-50">
            Vertical {{ Math.round(overlayOffsetY * 100) }}%
            <input v-model.number="overlayOffsetY" type="range" min="-0.2" max="0.2" step="0.005" class="form-range" @input="handleOverlayAdjustment" />
          </label>
          <label class="col-12 col-md-6 col-xl-3 small text-white-50">
            Rotation {{ Number(overlayRotation).toFixed(0) }}deg
            <input v-model.number="overlayRotation" type="range" min="-20" max="20" step="1" class="form-range" @input="handleOverlayAdjustment" />
          </label>
        </div>
      </div>
    </div>

    <!-- GEMINI AI OPTICAL STYLIST & MATCH EXPLANATION PANEL -->
    <div class="glass-panel p-3 p-md-4 rounded-4 mt-3 ai-explanation-panel">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div class="d-flex align-items-center gap-2">
          <span class="ai-sparkle-badge">
            ✨ {{ aiSource === 'gemini' ? 'Gemini AI Optical Match Analysis' : 'Optical Match Style Guidance' }}
          </span>
          <span v-if="detectedShape" class="badge bg-secondary rounded-pill px-2.5 py-1 small">
            📐 {{ detectedShape }} Face Shape
          </span>
        </div>
        <button
          type="button"
          class="btn btn-link btn-sm text-info p-0 text-decoration-none small d-inline-flex align-items-center gap-1"
          :disabled="aiLoading"
          @click="fetchAiExplanation"
        >
          <span>🔄</span> {{ aiLoading ? 'Analyzing...' : 'Refresh AI Analysis' }}
        </button>
      </div>

      <div v-if="aiLoading" class="d-flex align-items-center gap-3 py-2 text-info small">
        <div class="spinner-border spinner-border-sm text-info" role="status"></div>
        <span>Analyzing facial landmarks, bridge alignment, and optical match with Gemini AI...</span>
      </div>

      <div v-else-if="aiExplanation" class="ai-explanation-content">
        <p class="mb-2 text-white-90 fs-6" style="line-height: 1.65;">
          {{ aiExplanation }}
        </p>
        <div class="d-flex flex-wrap gap-2 pt-2 border-top border-white border-opacity-10 small text-muted-custom">
          <span>💡 <strong>Frame Fit:</strong> {{ currentFrame.shape || 'Standard' }} on {{ detectedShape || 'Oval' }} Face</span>
          <span>•</span>
          <span>🎨 <strong>Finish:</strong> {{ currentFrame.color || 'Classic' }}</span>
          <span>•</span>
          <span>💎 <strong>Lens Style:</strong> {{ activeTintName }}</span>
        </div>
      </div>

      <div v-else class="text-muted-custom small py-1">
        <span>✨ Start the live mirror or capture a snapshot to generate an instant Gemini AI facial match explanation tailored to your face structure!</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';

const props = defineProps({
  initialFrame: {
    type: Object,
    default: () => ({})
  },
  framesList: {
    type: Array,
    default: () => []
  },
  savedTryOn: {
    type: Object,
    default: null
  }
});

function clamp(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

const restoredOverlay = props.savedTryOn && props.savedTryOn.overlay_settings
  ? props.savedTryOn.overlay_settings
  : {};
const overlayScale = ref(clamp(restoredOverlay.scale, 1, 0.75, 1.35));
const overlayOffsetX = ref(clamp(restoredOverlay.offsetX, 0, -0.2, 0.2));
const overlayOffsetY = ref(clamp(restoredOverlay.offsetY, 0, -0.2, 0.2));
const overlayRotation = ref(clamp(restoredOverlay.rotation, 0, -20, 20));
const overlayOpacity = ref(clamp(restoredOverlay.opacity, 1, 0.35, 1));

// View modes: 'landing' (3 options), 'live-mirror', 'camera-capture', 'photo-result'
const viewMode = ref('landing');

// Why the last upload was rejected, shown under the landing buttons.
const uploadError = ref('');

// Establish catalog list and default selected frame
const catalogFrames = ref(
  props.framesList && props.framesList.length > 0
    ? props.framesList
    : (props.initialFrame && props.initialFrame.id ? [props.initialFrame] : [])
);

const currentFrame = ref(
  props.initialFrame && props.initialFrame.id
    ? { ...props.initialFrame }
    : (catalogFrames.value.length > 0 ? { ...catalogFrames.value[0] } : {})
);

const videoEl = ref(null);
const captureVideoEl = ref(null);
const canvasEl = ref(null);
const photoCanvasEl = ref(null);
const fileInputEl = ref(null);

const isStreaming = ref(false);
const isTracking = ref(false);
const cameraLoading = ref(false);
const cameraError = ref(null);
const facingMode = ref('user');
const modelLoading = ref(true);

let stream = null;
let captureStream = null;
let animationFrameId = null;

// MediaPipe landmarker reference
let faceLandmarkerInstance = null;
let landmarkerReady = false;

// Overlay Image Cache & Offscreen Processing for Photorealistic Catalog Overlays
const overlayImg = new Image();
overlayImg.crossOrigin = 'anonymous';
let overlayLoaded = false;
let processedOverlayCanvas = null;

// 1024px Normalized Ellipse Kappa
const NORMALIZED_ELLIPSE_KAPPA = 0.5522847498307936;

function createPolygonPath(points) {
  return points.map((pt, idx) => [idx === 0 ? 'M' : 'L', pt[0], pt[1]]).concat([['Z']]);
}

function createEllipsePath(cx, cy, rx, ry) {
  const controlX = rx * NORMALIZED_ELLIPSE_KAPPA;
  const controlY = ry * NORMALIZED_ELLIPSE_KAPPA;
  return [
    ['M', cx + rx, cy],
    ['C', cx + rx, cy + controlY, cx + controlX, cy + ry, cx, cy + ry],
    ['C', cx - controlX, cy + ry, cx - rx, cy + controlY, cx - rx, cy],
    ['C', cx - rx, cy - controlY, cx - controlX, cy - ry, cx, cy - ry],
    ['C', cx + controlX, cy - ry, cx + rx, cy - controlY, cx + rx, cy],
    ['Z']
  ];
}

function reflectPath(path) {
  return path.map(cmd => {
    const reflected = [...cmd];
    for (let i = 1; i < reflected.length; i += 2) {
      reflected[i] = 1 - reflected[i];
    }
    return reflected;
  });
}

const LENS_CONTOURS = {
  aviator: {
    left: createPolygonPath([
      [0.4160, 0.3877], [0.4414, 0.4277], [0.4404, 0.4785], [0.4111, 0.5498],
      [0.3604, 0.6123], [0.3213, 0.6406], [0.2646, 0.6611], [0.2100, 0.6553],
      [0.1602, 0.6221], [0.1289, 0.5684], [0.1133, 0.4941], [0.1211, 0.4346],
      [0.1494, 0.3945], [0.1973, 0.3711], [0.2773, 0.3594], [0.3613, 0.3652]
    ])
  },
  wayfarer: {
    left: createPolygonPath([
      [0.4229, 0.4385], [0.4336, 0.4678], [0.4248, 0.5342], [0.4043, 0.5830],
      [0.3760, 0.6172], [0.3438, 0.6387], [0.2949, 0.6484], [0.2246, 0.6455],
      [0.1709, 0.6260], [0.1445, 0.5752], [0.1299, 0.5117], [0.1309, 0.4531],
      [0.1523, 0.4170], [0.2041, 0.4004], [0.3047, 0.3984], [0.3838, 0.4141]
    ])
  },
  round: {
    left: createEllipsePath(0.279296875, 0.509765625, 0.169921875, 0.1640625)
  },
  clubmaster: {
    left: createPolygonPath([
      [0.1523, 0.4141], [0.1973, 0.3926], [0.2666, 0.3857], [0.3477, 0.3945],
      [0.3945, 0.4150], [0.4229, 0.4434], [0.4316, 0.4775], [0.4209, 0.5430],
      [0.3965, 0.5908], [0.3691, 0.6191], [0.3066, 0.6406], [0.2471, 0.6387],
      [0.1904, 0.6172], [0.1572, 0.5801], [0.1328, 0.5156], [0.1299, 0.4775]
    ])
  },
  titan: {
    left: [
      ['M', 0.1435547, 0.3935547],
      ['C', 0.2197266, 0.3818359, 0.3427734, 0.3837891, 0.4150391, 0.3955078],
      ['C', 0.4384766, 0.3994141, 0.4511719, 0.4150391, 0.4521484, 0.4384766],
      ['C', 0.4531250, 0.4707031, 0.4492188, 0.5107422, 0.4384766, 0.5410156],
      ['C', 0.4345703, 0.5712891, 0.4199219, 0.5927734, 0.3935547, 0.6054688],
      ['C', 0.3291016, 0.6289063, 0.2353516, 0.6289063, 0.1728516, 0.6093750],
      ['C', 0.1455078, 0.6005859, 0.1308594, 0.5800781, 0.1279297, 0.5527344],
      ['L', 0.1162109, 0.4482422],
      ['C', 0.1132813, 0.4208984, 0.1250000, 0.3994141, 0.1435547, 0.3935547],
      ['Z']
    ]
  },
  cateye: {
    left: createPolygonPath([
      [0.1064, 0.3896], [0.1758, 0.3770], [0.2764, 0.3789], [0.3525, 0.3945],
      [0.4082, 0.4219], [0.4287, 0.4453], [0.4375, 0.4824], [0.4180, 0.5625],
      [0.4014, 0.5918], [0.3613, 0.6309], [0.3047, 0.6533], [0.2344, 0.6504],
      [0.1875, 0.6299], [0.1494, 0.5957], [0.1133, 0.5332], [0.0967, 0.4658],
      [0.0957, 0.4092]
    ])
  },
  geometric: {
    left: createPolygonPath([
      [0.3848, 0.3945], [0.4248, 0.4424], [0.4346, 0.4727], [0.4268, 0.5400],
      [0.3867, 0.6182], [0.3623, 0.6387], [0.3086, 0.6494], [0.2305, 0.6465],
      [0.1875, 0.6328], [0.1484, 0.5723], [0.1299, 0.5078], [0.1309, 0.4541],
      [0.1621, 0.4014], [0.1914, 0.3838], [0.2461, 0.3789], [0.3359, 0.3818]
    ])
  },
  oval: {
    left: createEllipsePath(0.2730, 0.4956, 0.1538, 0.1392)
  },
  square: {
    left: createPolygonPath([
      [0.4541, 0.4453], [0.4609, 0.4736], [0.4580, 0.4902], [0.4160, 0.6084],
      [0.3848, 0.6416], [0.3535, 0.6484], [0.1689, 0.6309], [0.1201, 0.4531],
      [0.1211, 0.4375], [0.1963, 0.4219], [0.3740, 0.4092], [0.4219, 0.4160],
      [0.4395, 0.4287]
    ])
  }
};

Object.keys(LENS_CONTOURS).forEach(key => {
  LENS_CONTOURS[key].right = reflectPath(LENS_CONTOURS[key].left);
});

function drawPathCommands(ctx, commands, w, h) {
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const type = cmd[0];
    if (type === 'M') ctx.moveTo(cmd[1] * w, cmd[2] * h);
    else if (type === 'L') ctx.lineTo(cmd[1] * w, cmd[2] * h);
    else if (type === 'C') ctx.bezierCurveTo(cmd[1] * w, cmd[2] * h, cmd[3] * w, cmd[4] * h, cmd[5] * w, cmd[6] * h);
    else if (type === 'Q') ctx.quadraticCurveTo(cmd[1] * w, cmd[2] * h, cmd[3] * w, cmd[4] * h);
    else if (type === 'Z') ctx.closePath();
  }
}

function processCleanPhotorealisticOverlay(img, frame) {
  const canvas = document.createElement('canvas');
  const w = img.naturalWidth || img.width || 1024;
  const h = img.naturalHeight || img.height || 1024;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const fileName = (frame.image_url || '').split('/').pop().toLowerCase();
  const name = ((frame.shape || '') + ' ' + (frame.name || '') + ' ' + fileName).toLowerCase();

  // 1. Remove checkerboard squares in legacy assets
  if (fileName.includes('aviator') || fileName.includes('round')) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 250) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min <= 25 && (max >= 205 || (max >= 50 && max <= 145))) {
        data[i + 3] = 0;
      }
    }
  }

  // 2. Erase outer folded temple polygons
  const OVAL_TEMPLE = [[0.119, 0.452], [0.128, 0.475], [0.142, 0.502], [0.157, 0.532], [0.171, 0.562], [0.180, 0.586], [0.197, 0.590], [0.204, 0.574], [0.195, 0.548], [0.181, 0.516], [0.164, 0.484], [0.142, 0.454]];
  const CLUBMASTER_TEMPLE = [[0.141, 0.431], [0.148, 0.458], [0.162, 0.486], [0.178, 0.517], [0.195, 0.548], [0.208, 0.574], [0.220, 0.594], [0.238, 0.597], [0.252, 0.583], [0.249, 0.559], [0.233, 0.530], [0.216, 0.498], [0.198, 0.467], [0.177, 0.435], [0.154, 0.425]];
  const CATEYE_TEMPLE = [[0.096, 0.420], [0.103, 0.446], [0.124, 0.453], [0.142, 0.469], [0.160, 0.493], [0.177, 0.519], [0.195, 0.545], [0.211, 0.568], [0.231, 0.575], [0.243, 0.561], [0.232, 0.536], [0.214, 0.507], [0.194, 0.480], [0.173, 0.454], [0.148, 0.428], [0.122, 0.414]];
  const SPORT_TEMPLE = [
    [0.140, 0.420], [0.145, 0.458], [0.176, 0.479], [0.205, 0.500],
    [0.235, 0.522], [0.266, 0.544], [0.289, 0.550], [0.315, 0.540],
    [0.312, 0.505], [0.276, 0.485], [0.247, 0.465], [0.217, 0.442],
    [0.187, 0.422], [0.155, 0.415]
  ];

  function isInsidePoly(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function getPolyHorizontalBounds(y, polygon) {
    const intersections = [];
    for (let i = 0, previous = polygon.length - 1; i < polygon.length; previous = i, i += 1) {
      const currentX = polygon[i][0];
      const currentY = polygon[i][1];
      const previousX = polygon[previous][0];
      const previousY = polygon[previous][1];
      if ((currentY > y) !== (previousY > y)) {
        intersections.push(
          currentX + ((y - currentY) * (previousX - currentX)) / (previousY - currentY)
        );
      }
    }
    if (intersections.length < 2) return null;
    return [Math.min(...intersections), Math.max(...intersections)];
  }

  // Smoothly reconstructs smoke lens pixels across the folded temple region for Sport Wrap
  function processSportFrontOverlay(pixelData, width, height) {
    const originalPixels = new Uint8ClampedArray(pixelData);
    const samplePadding = Math.max(1, Math.round(width * 0.010));

    const reconstructRegion = (y, start, end) => {
      const sampleLeft = Math.max(0, start - samplePadding);
      const sampleRight = Math.min(width - 1, end + samplePadding);
      const span = Math.max(1, sampleRight - sampleLeft);

      for (let x = start; x <= end; x += 1) {
        const ratio = (x - sampleLeft) / span;
        const index = (y * width + x) * 4;
        const leftIndex = (y * width + sampleLeft) * 4;
        const rightIndex = (y * width + sampleRight) * 4;

        for (let channel = 0; channel < 4; channel += 1) {
          pixelData[index + channel] = Math.round(
            originalPixels[leftIndex + channel] +
            (originalPixels[rightIndex + channel] - originalPixels[leftIndex + channel]) * ratio
          );
        }
      }
    };

    for (let y = 0; y < height; y += 1) {
      const ny = (y + 0.5) / height;
      if (ny < 0.410 || ny > 0.555) continue;

      const bounds = getPolyHorizontalBounds(ny, SPORT_TEMPLE);
      if (!bounds) continue;

      const leftStart = Math.max(0, Math.floor(bounds[0] * width));
      const leftEnd = Math.min(width - 1, Math.ceil(bounds[1] * width));
      reconstructRegion(y, leftStart, leftEnd);

      const rightStart = width - 1 - leftEnd;
      const rightEnd = width - 1 - leftStart;
      reconstructRegion(y, rightStart, rightEnd);
    }
  }

  let targetPoly = null;
  if (name.includes('clubmaster')) targetPoly = CLUBMASTER_TEMPLE;
  else if (name.includes('cat') || name.includes('cateye')) targetPoly = CATEYE_TEMPLE;
  else if (name.includes('oval')) targetPoly = OVAL_TEMPLE;

  if (targetPoly) {
    for (let y = 0; y < h; y++) {
      const ny = (y + 0.5) / h;
      for (let x = 0; x < w; x++) {
        const nx = (x + 0.5) / w;
        const mirX = nx > 0.5 ? 1 - nx : nx;
        if (isInsidePoly(mirX, ny, targetPoly)) {
          const idx = (y * w + x) * 4;
          data[idx + 3] = 0;
        }
      }
    }
  }

  if (name.includes('sport') || name.includes('wrap')) {
    processSportFrontOverlay(data, w, h);
  }

  if (name.includes('square')) {
    for (let y = 0; y < h; y++) {
      const ny = (y + 0.5) / h;
      if (ny >= 0.565) {
        const progress = Math.min(1, Math.max(0, (ny - 0.565) / 0.115));
        const outerBoundary = 0.142 + progress * 0.048;
        for (let x = 0; x < w; x++) {
          const nx = (x + 0.5) / w;
          if (nx < outerBoundary || nx > 1 - outerBoundary) {
            const idx = (y * w + x) * 4;
            data[idx + 3] = 0;
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

let cachedPhotoLandmarks = null;

overlayImg.onload = () => {
  overlayLoaded = true;
  try {
    processedOverlayCanvas = processCleanPhotorealisticOverlay(overlayImg, currentFrame.value);
  } catch (err) {
    console.warn('Overlay cleaning failed, using raw overlay:', err);
    processedOverlayCanvas = null;
  }
  if (viewMode.value === 'photo-result' && capturedImageSrc.value) {
    renderPhotoOverlay();
  }
};

let overlayFallbackAttempted = false;
overlayImg.onerror = () => {
  if (!overlayFallbackAttempted && currentFrame.value && currentFrame.value.image_url) {
    overlayFallbackAttempted = true;
    overlayImg.src = currentFrame.value.image_url;
  }
};

function getOverlayUrl(frame) {
  if (!frame || !frame.image_url) return '';
  // Load the authentic, photorealistic catalog overlay image
  return frame.image_url.replace(/\.png$/i, '_overlay.png');
}

function loadFrameOverlay(frame) {
  overlayLoaded = false;
  processedOverlayCanvas = null;
  overlayFallbackAttempted = false;
  if (frame && frame.image_url) {
    overlayImg.src = getOverlayUrl(frame);
  }
}

onMounted(async () => {
  loadFrameOverlay(currentFrame.value);
  try {
    await initFaceLandmarker();
  } catch (err) {
    console.warn('Eager landmarker initialization error:', err);
  }
});

watch(currentFrame, (newVal) => {
  if (newVal) {
    loadFrameOverlay(newVal);
    triggerDebouncedAiFetch();
    if (viewMode.value === 'photo-result' && capturedImageSrc.value) {
      renderPhotoOverlay();
    }
  }
}, { immediate: true });

const capturedImageSrc = ref(null);
const isSaving = ref(false);
const detectedShape = ref(null);
const confidenceScore = ref(0.92);

const aiExplanation = ref('');
const aiLoading = ref(false);
const aiSource = ref('fallback');
let aiDebounceTimer = null;

// These must stay in step with public/js/lens-tint-palette.js: the label chosen
// here travels to the server as the lens option on saved try-ons and style
// suggestions, and resolveLensTint only recognises the labels below. A local
// invention (Ocean Blue, Rose Gold, ...) normalises to "Clear Lens", silently
// discarding the tint the customer previewed. LensTintSwatches.vue on the frame
// details page carries the same five.
const availableTints = [
  { id: 'clear', name: 'Clear Lens', colorHex: 'rgba(255,255,255,0.08)', tintHex: 'transparent', icon: '⚪' },
  { id: 'blue-light', name: 'Blue-Light Lens', colorHex: 'rgba(135,196,222,0.55)', tintHex: 'rgba(135,196,222,0.09)', icon: '💻' },
  { id: 'gray', name: 'Gray Tint', colorHex: 'rgba(65,69,74,0.88)', tintHex: 'rgba(65,69,74,0.38)', icon: '🕶️' },
  { id: 'brown', name: 'Brown Tint', colorHex: 'rgba(109,74,43,0.90)', tintHex: 'rgba(109,74,43,0.40)', icon: '🟤' },
  { id: 'sunglass', name: 'Sunglass Tint', colorHex: 'rgba(18,22,26,0.98)', tintHex: 'rgba(18,22,26,0.72)', icon: '☀️' }
];
const activeTintId = ref('clear');

const activeTintName = computed(() => {
  const t = availableTints.find(item => item.id === activeTintId.value);
  return t ? t.name : 'Clear Lens';
});

const recommendedStyles = computed(() => {
  if (detectedShape.value === 'Round') return 'Square, Rectangular, Geometric';
  if (detectedShape.value === 'Square') return 'Round, Oval, Aviator';
  if (detectedShape.value === 'Heart') return 'Cat-Eye, Oval, Browline';
  if (detectedShape.value === 'Diamond') return 'Oval, Browline, Cat-Eye';
  if (detectedShape.value === 'Oblong') return 'Round, Square, Aviator, Browline';
  return 'Aviator, Browline, Rectangular, Geometric';
});

function triggerDebouncedAiFetch() {
  if (aiDebounceTimer) clearTimeout(aiDebounceTimer);
  aiDebounceTimer = setTimeout(() => {
    fetchAiExplanation();
  }, 400);
}

async function fetchAiExplanation() {
  if (!currentFrame.value || !currentFrame.value.id) return;
  aiLoading.value = true;
  try {
    const res = await fetch('/customer/ai-style-suggestion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frameId: currentFrame.value.id,
        color: currentFrame.value.color,
        lensStyle: activeTintName.value,
        faceShape: detectedShape.value || 'Oval'
      })
    });
    const data = await res.json();
    if (data.success && data.suggestion) {
      aiExplanation.value = data.suggestion;
      aiSource.value = data.source || 'fallback';
    }
  } catch (err) {
    console.warn('AI style suggestion fetch failed:', err);
  } finally {
    aiLoading.value = false;
  }
}

function setTint(tint) {
  activeTintId.value = tint.id;
  triggerDebouncedAiFetch();
  if (viewMode.value === 'photo-result' && capturedImageSrc.value) {
    renderPhotoOverlay();
  }
}

function handleOverlayAdjustment() {
  if (viewMode.value === 'photo-result' && capturedImageSrc.value) {
    renderPhotoOverlay();
  }
}

function resetOverlaySettings() {
  overlayScale.value = 1;
  overlayOffsetX.value = 0;
  overlayOffsetY.value = 0;
  overlayRotation.value = 0;
  overlayOpacity.value = 1;
  handleOverlayAdjustment();
}

function switchFrame(frame) {
  currentFrame.value = frame;
  loadFrameOverlay(frame);
  triggerDebouncedAiFetch();
  if (viewMode.value === 'photo-result' && capturedImageSrc.value) {
    renderPhotoOverlay();
  }
}

function handleImgError(e) {
  e.target.src = 'https://placehold.co/320x200/1a1a2e/a78bfa?text=🕶️+No+Image';
}

// MediaPipe Vision Initializer
async function initFaceLandmarker() {
  if (faceLandmarkerInstance) return faceLandmarkerInstance;
  try {
    modelLoading.value = true;
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs');
    const filesetResolver = await vision.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
    );
    faceLandmarkerInstance = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU'
      },
      outputFaceBlendshapes: false,
      runningMode: 'VIDEO',
      numFaces: 1
    });
    landmarkerReady = true;
    modelLoading.value = false;
    return faceLandmarkerInstance;
  } catch (err) {
    console.warn('FaceLandmarker GPU init failed, falling back to CPU:', err);
    try {
      const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs');
      const filesetResolver = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      );
      faceLandmarkerInstance = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'CPU'
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 1
      });
      landmarkerReady = true;
      modelLoading.value = false;
      return faceLandmarkerInstance;
    } catch (fallbackErr) {
      console.error('FaceLandmarker initialization failed:', fallbackErr);
      modelLoading.value = false;
      return null;
    }
  }
}

// Landmark smoothing state to eliminate high-frequency flickering
let smoothedLandmarks = null;
let consecutiveMisses = 0;

function smoothFaceLandmarks(rawLandmarks, alpha = 0.45) {
  if (!smoothedLandmarks || smoothedLandmarks.length !== rawLandmarks.length) {
    smoothedLandmarks = rawLandmarks.map(p => ({ x: p.x, y: p.y, z: p.z || 0 }));
    return smoothedLandmarks;
  }

  for (let i = 0; i < rawLandmarks.length; i++) {
    smoothedLandmarks[i].x = smoothedLandmarks[i].x * (1 - alpha) + rawLandmarks[i].x * alpha;
    smoothedLandmarks[i].y = smoothedLandmarks[i].y * (1 - alpha) + rawLandmarks[i].y * alpha;
    if (rawLandmarks[i].z !== undefined) {
      smoothedLandmarks[i].z = smoothedLandmarks[i].z * (1 - alpha) + rawLandmarks[i].z * alpha;
    }
  }
  return smoothedLandmarks;
}

// Calibrated Face Shape Estimator
function estimateFaceShapeFromLandmarks(landmarks, canvasW, canvasH) {
  if (!landmarks || landmarks.length < 468) return 'Oval';

  // 10: Forehead top, 152: Chin bottom
  // 54, 284: Forehead breadth
  // 234, 454: Cheekbone breadth
  // 172, 397: Jawline breadth
  const foreheadWidth = Math.hypot(
    (landmarks[284].x - landmarks[54].x) * canvasW,
    (landmarks[284].y - landmarks[54].y) * canvasH
  );
  const faceWidth = Math.hypot(
    (landmarks[454].x - landmarks[234].x) * canvasW,
    (landmarks[454].y - landmarks[234].y) * canvasH
  ) || 1;
  const jawWidth = Math.hypot(
    (landmarks[397].x - landmarks[172].x) * canvasW,
    (landmarks[397].y - landmarks[172].y) * canvasH
  );
  const faceHeight = Math.hypot(
    (landmarks[152].x - landmarks[10].x) * canvasW,
    (landmarks[152].y - landmarks[10].y) * canvasH
  );

  const aspectRatio = faceHeight / faceWidth;
  const jawRatio = jawWidth / faceWidth;
  const foreheadRatio = foreheadWidth / faceWidth;

  // Calibrated classifications
  if (aspectRatio >= 1.25) {
    if (jawRatio > 0.84) return 'Oblong';
    return 'Oval';
  }

  if (aspectRatio >= 1.10) {
    if (jawRatio > 0.88 && foreheadRatio > 0.88) return 'Square';
    if (foreheadRatio > 0.88 && jawRatio < 0.74) return 'Heart';
    if (foreheadRatio < 0.80 && jawRatio < 0.74) return 'Diamond';
    return 'Oval';
  }

  if (jawRatio > 0.86) return 'Square';
  return 'Round';
}

// Renders Glasses Front + Temples onto Canvas Context
function drawGlassesAndTemples(ctx, landmarks, canvasW, canvasH) {
  if (!landmarks || landmarks.length < 468) return;

  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const noseBridge = landmarks[168] || landmarks[6];
  const leftEar = landmarks[234];
  const rightEar = landmarks[454];

  const leftX = leftEye.x * canvasW;
  const leftY = leftEye.y * canvasH;
  const rightX = rightEye.x * canvasW;
  const rightY = rightEye.y * canvasH;

  const dx = rightX - leftX;
  const dy = rightY - leftY;
  const eyeDistance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) + (overlayRotation.value * Math.PI / 180);

  const bridgeX = (noseBridge ? noseBridge.x : (leftEye.x + rightEye.x) / 2) * canvasW + overlayOffsetX.value * canvasW;
  const bridgeY = (noseBridge ? noseBridge.y : (leftEye.y + rightEye.y) / 2) * canvasH;

  const HINGE_PROFILES = {
    aviator: { leftHinge: { x: 0.103, y: 0.469 }, rightHinge: { x: 0.897, y: 0.469 } },
    wayfarer: { leftHinge: { x: 0.102, y: 0.425 }, rightHinge: { x: 0.898, y: 0.425 } },
    round: { leftHinge: { x: 0.109, y: 0.493 }, rightHinge: { x: 0.891, y: 0.493 } },
    clubmaster: { leftHinge: { x: 0.101, y: 0.408 }, rightHinge: { x: 0.899, y: 0.408 } },
    titan: { leftHinge: { x: 0.102, y: 0.449 }, rightHinge: { x: 0.898, y: 0.449 } },
    cateye: { leftHinge: { x: 0.071, y: 0.438 }, rightHinge: { x: 0.929, y: 0.438 } },
    geometric: { leftHinge: { x: 0.067, y: 0.454 }, rightHinge: { x: 0.933, y: 0.454 } },
    oval: { leftHinge: { x: 0.097, y: 0.428 }, rightHinge: { x: 0.903, y: 0.428 } },
    sport: { leftHinge: { x: 0.098, y: 0.439 }, rightHinge: { x: 0.902, y: 0.439 } },
    square: { leftHinge: { x: 0.098, y: 0.439 }, rightHinge: { x: 0.902, y: 0.439 } },
    default: { leftHinge: { x: 0.105, y: 0.440 }, rightHinge: { x: 0.895, y: 0.440 } }
  };

  function getFrameHingeProfile(frame) {
    if (!frame) return HINGE_PROFILES.default;
    const name = ((frame.shape || '') + ' ' + (frame.name || '')).toLowerCase();
    if (name.includes('aviator')) return HINGE_PROFILES.aviator;
    if (name.includes('wayfarer')) return HINGE_PROFILES.wayfarer;
    if (name.includes('round')) return HINGE_PROFILES.round;
    if (name.includes('clubmaster')) return HINGE_PROFILES.clubmaster;
    if (name.includes('titan')) return HINGE_PROFILES.titan;
    if (name.includes('cat') || name.includes('cateye')) return HINGE_PROFILES.cateye;
    if (name.includes('geometric')) return HINGE_PROFILES.geometric;
    if (name.includes('oval')) return HINGE_PROFILES.oval;
    if (name.includes('sport') || name.includes('wrap')) return HINGE_PROFILES.sport;
    if (name.includes('square')) return HINGE_PROFILES.square;
    return HINGE_PROFILES.default;
  }

  // Dynamic face shape estimation with calibrated multi-landmark classifier
  if (!detectedShape.value && landmarks[10] && landmarks[152]) {
    const shape = estimateFaceShapeFromLandmarks(landmarks, canvasW, canvasH);
    detectedShape.value = shape;
    triggerDebouncedAiFetch();
  }

  // Optimized natural face-proportioned frame width (1.76x eye span, bounded to temple breadth)
  const faceWidthAtTemples = (leftEar && rightEar)
    ? Math.hypot((rightEar.x - leftEar.x) * canvasW, (rightEar.y - leftEar.y) * canvasH)
    : eyeDistance * 1.55;
  const frameWidth = Math.min(eyeDistance * 1.76, faceWidthAtTemples * 1.12) * overlayScale.value;

  const aspect = (overlayImg.naturalHeight && overlayImg.naturalWidth)
    ? (overlayImg.naturalHeight / overlayImg.naturalWidth)
    : 0.38;
  const frameHeight = frameWidth * aspect;
  const frameCenterY = bridgeY + frameHeight * 0.02 + overlayOffsetY.value * canvasH;

  // Convert the selected frame's normalized hinge locations into canvas
  // coordinates. These values are shared by both the live and photo renderers.
  // They must be calculated before drawing the temple arms; otherwise the
  // first detected face throws a ReferenceError and stops all overlay drawing.
  const hingeProfile = getFrameHingeProfile(currentFrame.value);
  const leftHingeLocalX = (hingeProfile.leftHinge.x - 0.5) * frameWidth;
  const leftHingeLocalY = (hingeProfile.leftHinge.y - 0.5) * frameHeight;
  const rightHingeLocalX = (hingeProfile.rightHinge.x - 0.5) * frameWidth;
  const rightHingeLocalY = (hingeProfile.rightHinge.y - 0.5) * frameHeight;

  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);
  const leftHingeX = bridgeX + (leftHingeLocalX * cosAngle - leftHingeLocalY * sinAngle);
  const leftHingeY = frameCenterY + (leftHingeLocalX * sinAngle + leftHingeLocalY * cosAngle);
  const rightHingeX = bridgeX + (rightHingeLocalX * cosAngle - rightHingeLocalY * sinAngle);
  const rightHingeY = frameCenterY + (rightHingeLocalX * sinAngle + rightHingeLocalY * cosAngle);

  const leftEarX = leftEar.x * canvasW;
  const leftEarY = leftEar.y * canvasH;
  const rightEarX = rightEar.x * canvasW;
  const rightEarY = rightEar.y * canvasH;

  // Resolve frame temple color
  const colorName = (currentFrame.value.color || 'black').toLowerCase();
  const colorMap = {
    gold: '#c9a54e',
    'rose gold': '#c78e86',
    silver: '#c9ccd1',
    gunmetal: '#565a5e',
    black: '#1c1c1e',
    'matte black': '#2a2a2c',
    tortoise: '#6b4423',
    'honey brown': '#b5792b',
    brown: '#5b3a1e',
    'crystal clear': 'rgba(216, 221, 227, 0.75)',
    blue: '#2c4a7c',
    navy: '#1e2a44'
  };
  const templeColor = colorMap[colorName] || '#2a2a2c';

  // 1. DRAW TEMPLES BEHIND FRONT FRAME (Hinge aligned to ears for all frames)
  ctx.save();
  ctx.globalAlpha = overlayOpacity.value;
  ctx.strokeStyle = templeColor;
  ctx.lineWidth = Math.max(2.5, frameWidth * 0.022);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 3;

  // Left temple arm curve
  ctx.beginPath();
  ctx.moveTo(leftHingeX, leftHingeY);
  const leftMidX = leftHingeX * 0.45 + leftEarX * 0.55;
  const leftMidY = leftHingeY * 0.45 + leftEarY * 0.55 - frameHeight * 0.04;
  ctx.quadraticCurveTo(leftMidX, leftMidY, leftEarX, leftEarY);
  ctx.stroke();

  // Right temple arm curve
  ctx.beginPath();
  ctx.moveTo(rightHingeX, rightHingeY);
  const rightMidX = rightHingeX * 0.45 + rightEarX * 0.55;
  const rightMidY = rightHingeY * 0.45 + rightEarY * 0.55 - frameHeight * 0.04;
  ctx.quadraticCurveTo(rightMidX, rightMidY, rightEarX, rightEarY);
  ctx.stroke();
  ctx.restore();

  // 2. DRAW AUTHENTIC PHOTOREALISTIC CATALOG FRONT FRAME ON TOP
  ctx.save();
  ctx.globalAlpha = overlayOpacity.value;
  ctx.translate(bridgeX, frameCenterY);
  ctx.rotate(angle);

  const renderSource = processedOverlayCanvas || (overlayLoaded && overlayImg.complete && overlayImg.naturalWidth > 0 ? overlayImg : null);

  if (renderSource) {
    ctx.drawImage(renderSource, -frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight);

    // Apply lens tint inside lens aperture
    const activeTint = availableTints.find(t => t.id === activeTintId.value);
    if (activeTint && activeTint.tintHex !== 'transparent') {
      const name = ((currentFrame.value.shape || '') + ' ' + (currentFrame.value.name || '')).toLowerCase();
      let contourKey = null;
      if (name.includes('aviator')) contourKey = 'aviator';
      else if (name.includes('wayfarer')) contourKey = 'wayfarer';
      else if (name.includes('round')) contourKey = 'round';
      else if (name.includes('clubmaster')) contourKey = 'clubmaster';
      else if (name.includes('titan')) contourKey = 'titan';
      else if (name.includes('cat') || name.includes('cateye')) contourKey = 'cateye';
      else if (name.includes('geometric')) contourKey = 'geometric';
      else if (name.includes('oval')) contourKey = 'oval';
      else if (name.includes('square')) contourKey = 'square';

      if (contourKey && LENS_CONTOURS[contourKey]) {
        ctx.save();
        ctx.fillStyle = activeTint.tintHex;
        ctx.translate(-frameWidth / 2, -frameHeight / 2);
        
        ctx.beginPath();
        drawPathCommands(ctx, LENS_CONTOURS[contourKey].left, frameWidth, frameHeight);
        ctx.fill();

        ctx.beginPath();
        drawPathCommands(ctx, LENS_CONTOURS[contourKey].right, frameWidth, frameHeight);
        ctx.fill();

        ctx.restore();
      }
    }
  } else {
    // Elegant fallback wireframe glasses while overlay is downloading
    ctx.strokeStyle = templeColor;
    ctx.lineWidth = 3;
    const lensR = eyeDistance * 0.44;
    ctx.beginPath();
    ctx.arc(-eyeDistance * 0.52, 0, lensR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(eyeDistance * 0.52, 0, lensR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-eyeDistance * 0.12, 0);
    ctx.lineTo(eyeDistance * 0.12, 0);
    ctx.stroke();
  }

  ctx.restore();
}

// Continuous 60fps Render Loop (Zero-flicker with EMA smoothing)
let lastVideoTime = -1;
function renderLiveLoop() {
  if (viewMode.value !== 'live-mirror' || !isStreaming.value || !videoEl.value) return;

  const video = videoEl.value;
  const canvas = canvasEl.value;

  if (video.readyState >= 2 && canvas) {
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    const ctx = canvas.getContext('2d');

    // Run MediaPipe detection when video time advances
    if (faceLandmarkerInstance && landmarkerReady) {
      const currentTime = video.currentTime;
      if (currentTime !== lastVideoTime) {
        lastVideoTime = currentTime;
        try {
          const results = faceLandmarkerInstance.detectForVideo(video, performance.now());
          if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            isTracking.value = true;
            consecutiveMisses = 0;
            smoothFaceLandmarks(results.faceLandmarks[0], 0.45);
          } else {
            consecutiveMisses++;
            if (consecutiveMisses > 6) {
              isTracking.value = false;
              smoothedLandmarks = null;
            }
          }
        } catch (e) {
          // ignore transient detection glitch
        }
      }
    }

    // Always clear and render smoothed frame on EVERY animation tick (no strobe flickering)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (smoothedLandmarks) {
      drawGlassesAndTemples(ctx, smoothedLandmarks, canvas.width, canvas.height);
    }
  }

  animationFrameId = requestAnimationFrame(renderLiveLoop);
}

// Action: Enter Live Mirror
async function enterLiveMirror() {
  viewMode.value = 'live-mirror';
  cameraLoading.value = true;
  cameraError.value = null;

  try {
    await initFaceLandmarker();
    stopStreams();

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: facingMode.value,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    if (videoEl.value) {
      videoEl.value.srcObject = stream;
      await videoEl.value.play();
      isStreaming.value = true;
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(renderLiveLoop);
    }
  } catch (err) {
    console.error('Live mirror camera start failed:', err);
    cameraError.value = 'Unable to access camera. Please check camera permissions in your browser.';
  } finally {
    cameraLoading.value = false;
  }
}

// Action: Enter Camera Capture Mode (Still photo)
async function enterCameraCapture() {
  viewMode.value = 'camera-capture';
  cameraLoading.value = true;
  cameraError.value = null;

  try {
    await initFaceLandmarker();
    stopStreams();

    captureStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: facingMode.value,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    if (captureVideoEl.value) {
      captureVideoEl.value.srcObject = captureStream;
      await captureVideoEl.value.play();
    }
  } catch (err) {
    console.error('Camera capture start failed:', err);
    cameraError.value = 'Unable to access camera. Please check camera permissions in your browser.';
  } finally {
    cameraLoading.value = false;
  }
}

function takeStillPhoto() {
  if (!captureVideoEl.value) return;
  const video = captureVideoEl.value;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = video.videoWidth || 640;
  tempCanvas.height = video.videoHeight || 480;
  const ctx = tempCanvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  cachedPhotoLandmarks = null;
  capturedImageSrc.value = tempCanvas.toDataURL('image/jpeg', 0.95);
  stopStreams();
  viewMode.value = 'photo-result';

  setTimeout(() => {
    renderPhotoOverlay();
  }, 60);
}

function captureSnapshotFromLive() {
  if (!videoEl.value || !canvasEl.value) return;
  const video = videoEl.value;

  const compCanvas = document.createElement('canvas');
  compCanvas.width = video.videoWidth || 640;
  compCanvas.height = video.videoHeight || 480;
  const ctx = compCanvas.getContext('2d');

  // Capture a clean mirrored base photo. The adjustable overlay is rendered
  // once in the result editor so saved fit settings match the final image.
  ctx.save();
  ctx.translate(compCanvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, compCanvas.width, compCanvas.height);
  ctx.restore();

  cachedPhotoLandmarks = null;
  capturedImageSrc.value = compCanvas.toDataURL('image/jpeg', 0.95);
  stopStreams();
  viewMode.value = 'photo-result';

  setTimeout(() => {
    renderPhotoOverlay();
  }, 60);
}

function triggerFileInput() {
  if (fileInputEl.value) {
    fileInputEl.value.click();
  }
}

// accept="image/*" on the input is only a hint for the file picker — the
// customer can switch it to "All files", and it says nothing about size. A
// captured photo is base64'd into the try-on workspace and posted to the
// server on save, where bodyParser caps the body at 10mb, so an oversized
// pick has to be refused here rather than failing later.
// Keep the base64 form (about 4/3 the byte size) below Vercel's request limit
// once the finished look and overlay settings are posted back on save.
const ACCEPTED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

function describeFileSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function validateUploadedImage(file) {
  const type = (file.type || '').toLowerCase();

  if (!type.startsWith('image/')) {
    return `"${file.name}" is not an image. Choose a JPG, PNG, or WebP photo.`;
  }
  if (!ACCEPTED_UPLOAD_TYPES.includes(type)) {
    return `${type.replace('image/', '').toUpperCase()} images are not supported here. Choose a JPG, PNG, or WebP photo.`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty. Choose a different photo.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That photo is ${describeFileSize(file.size)}. Please choose one under ${describeFileSize(MAX_UPLOAD_BYTES)}.`;
  }
  return null;
}

function handleFileUpload(e) {
  const input = e.target;
  const file = input.files && input.files[0];
  uploadError.value = '';
  if (!file) return;

  const problem = validateUploadedImage(file);
  if (problem) {
    uploadError.value = problem;
    // Clear the input so picking the same file again still fires a change.
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => {
    uploadError.value = 'That photo could not be read. Please try another file.';
    input.value = '';
  };
  reader.onload = (event) => {
    cachedPhotoLandmarks = null;
    capturedImageSrc.value = event.target.result;
    detectedShape.value = 'Oval';
    triggerDebouncedAiFetch();
    viewMode.value = 'photo-result';
    setTimeout(() => {
      renderPhotoOverlay();
    }, 60);
    input.value = '';
  };
  reader.readAsDataURL(file);
}

async function renderPhotoOverlay() {
  if (!capturedImageSrc.value || !photoCanvasEl.value) return;

  const canvas = photoCanvasEl.value;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = async () => {
    const sourceWidth = img.naturalWidth || 640;
    const sourceHeight = img.naturalHeight || 480;
    const maximumDimension = 1600;
    const renderScale = Math.min(1, maximumDimension / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.round(sourceWidth * renderScale);
    canvas.height = Math.round(sourceHeight * renderScale);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (!faceLandmarkerInstance) {
      await initFaceLandmarker();
    }

    if (!cachedPhotoLandmarks && faceLandmarkerInstance) {
      try {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = canvas.width;
        offCanvas.height = canvas.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(img, 0, 0, offCanvas.width, offCanvas.height);

        const results = faceLandmarkerInstance.detectForVideo(offCanvas, performance.now());
        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
          cachedPhotoLandmarks = results.faceLandmarks[0];
          const shape = estimateFaceShapeFromLandmarks(cachedPhotoLandmarks, canvas.width, canvas.height);
          detectedShape.value = shape;
          triggerDebouncedAiFetch();
        }
      } catch (e) {
        console.warn('Photo landmark detection error:', e);
      }
    }

    if (cachedPhotoLandmarks) {
      drawGlassesAndTemples(ctx, cachedPhotoLandmarks, canvas.width, canvas.height);
    }
  };
  img.src = capturedImageSrc.value;
}

function returnToLanding() {
  stopStreams();
  cameraError.value = null;
  capturedImageSrc.value = null;
  cachedPhotoLandmarks = null;
  smoothedLandmarks = null;
  viewMode.value = 'landing';
}

function stopStreams() {
  isStreaming.value = false;
  isTracking.value = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (captureStream) {
    captureStream.getTracks().forEach(t => t.stop());
    captureStream = null;
  }
}

function toggleCameraFacing() {
  facingMode.value = facingMode.value === 'user' ? 'environment' : 'user';
  if (viewMode.value === 'live-mirror') {
    enterLiveMirror();
  } else if (viewMode.value === 'camera-capture') {
    enterCameraCapture();
  }
}

async function saveSnapshotToHistory() {
  if (!capturedImageSrc.value && !photoCanvasEl.value) return;

  isSaving.value = true;
  try {
    const finalData = photoCanvasEl.value
      ? photoCanvasEl.value.toDataURL('image/jpeg', 0.85)
      : capturedImageSrc.value;

    const res = await fetch('/customer/tryon-history/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frameId: currentFrame.value.id,
        imageData: finalData,
        faceShape: detectedShape.value || 'Oval',
        lensOption: activeTintName.value,
        colorOption: currentFrame.value.color,
        overlaySettings: {
          scale: overlayScale.value,
          offsetX: overlayOffsetX.value,
          offsetY: overlayOffsetY.value,
          rotation: overlayRotation.value,
          opacity: overlayOpacity.value
        }
      })
    });
    const data = await res.json();
    if (data.success) {
      alert('Snapshot successfully saved to your Try-On History! 🎉');
    } else {
      throw new Error(data.error || 'Failed to save snapshot');
    }
  } catch (err) {
    console.error('Failed to save snapshot:', err);
    alert(`Could not save snapshot: ${err.message}`);
  } finally {
    isSaving.value = false;
  }
}

function downloadSnapshot() {
  if (!photoCanvasEl.value && !capturedImageSrc.value) return;
  const src = photoCanvasEl.value ? photoCanvasEl.value.toDataURL('image/jpeg', 0.95) : capturedImageSrc.value;
  const link = document.createElement('a');
  link.download = `tryon-${(currentFrame.value.name || 'frame').replace(/\s+/g, '-').toLowerCase()}.jpg`;
  link.href = src;
  link.click();
}

onMounted(() => {
  if (props.savedTryOn) {
    const restoredTint = availableTints.find(tint =>
      tint.name.toLowerCase() === String(props.savedTryOn.lens_option || '').toLowerCase()
    );
    if (restoredTint) activeTintId.value = restoredTint.id;
    detectedShape.value = props.savedTryOn.face_shape || null;
  }
  if (currentFrame.value) {
    loadFrameOverlay(currentFrame.value);
  }
  initFaceLandmarker();
  fetchAiExplanation();
});

onBeforeUnmount(() => {
  stopStreams();
});
</script>

<style scoped>
.virtual-tryon-root {
  width: 100%;
}

.tryon-frame-thumb-sm {
  width: 60px;
  height: 38px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  overflow: hidden;
  flex-shrink: 0;
}

.tryon-frame-thumb-sm img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.tryon-viewport-container {
  min-height: 520px;
  height: 60vh;
  max-height: 650px;
  background: rgba(2, 6, 23, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tryon-stage-live,
.tryon-stage-camera {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.tryon-upload-error {
  max-width: 460px;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.32);
  border-radius: 10px;
  padding: 0.5rem 0.85rem;
  line-height: 1.45;
}

.tryon-video-feed {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.tryon-canvas-feed {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
  pointer-events: none;
}

.tryon-live-hud {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 10;
}

.tryon-hud-badge {
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  padding: 0.35rem 0.85rem;
  border-radius: 50px;
  font-size: 0.78rem;
  color: #e2e8f0;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.hud-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}

.hud-status-dot.hud-active {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.tryon-hud-shape-badge {
  background: rgba(124, 58, 237, 0.85);
  border: 1px solid rgba(167, 139, 250, 0.3);
  backdrop-filter: blur(8px);
  padding: 0.35rem 0.85rem;
  border-radius: 50px;
  font-size: 0.78rem;
  color: #fff;
  font-weight: 700;
}

.tryon-camera-error-banner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 18px;
  max-width: 420px;
  z-index: 20;
}

.tryon-viewport-controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 10;
  background: rgba(2, 6, 23, 0.6);
  padding: 0.5rem 1rem;
  border-radius: 50px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
}

.tryon-composite-canvas {
  max-height: 480px;
  max-width: 100%;
  object-fit: contain;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
}

.tryon-frames-carousel {
  scrollbar-width: thin;
}

.tryon-frame-card {
  min-width: 110px;
  max-width: 130px;
  padding: 0.5rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.tryon-frame-card:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.tryon-frame-card.active {
  border-color: #7c3aed;
  background: rgba(124, 58, 237, 0.25);
  box-shadow: 0 0 12px rgba(124, 58, 237, 0.4);
}

.tryon-frame-card-img {
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.25rem;
}

.tryon-frame-card-img img {
  max-height: 38px;
  max-width: 90%;
  object-fit: contain;
}

.tryon-frame-card-name {
  font-size: 0.72rem;
  color: #fff;
  font-weight: 600;
}

.tint-swatch {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s, border-color 0.2s;
  padding: 0;
}

.tint-swatch:hover {
  transform: scale(1.15);
}

.tint-swatch.active {
  border-color: #a78bfa;
  transform: scale(1.2);
  box-shadow: 0 0 10px rgba(167, 139, 250, 0.6);
}

.swatch-icon {
  font-size: 0.85rem;
}

.ai-explanation-panel {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.14), rgba(20, 184, 166, 0.08));
  border: 1px solid rgba(167, 139, 250, 0.3);
}

.ai-sparkle-badge {
  font-weight: 700;
  color: #c4b5fd;
  font-size: 0.95rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.text-white-90 {
  color: rgba(255, 255, 255, 0.92);
}
</style>
