<template>
  <div class="ai-recommendations-root">
    <!-- CAPTURE / INPUT STAGE -->
    <div v-if="step === 'capture'" class="glass-panel p-4 rounded-4 mb-4">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
        <div class="d-flex align-items-center gap-3">
          <span class="fs-1">🤖</span>
          <div>
            <h3 class="fs-5 font-weight-700 text-white mb-0">AI Facial Geometry & Frame Matching</h3>
            <p class="small text-muted-custom mb-0">Capture a photo or upload a portrait to analyze your facial landmark structure and receive AI-curated frame recommendations powered by Gemini.</p>
          </div>
        </div>
        <div class="model-status-tag">
          <span v-if="modelLoading" class="badge bg-warning text-dark px-3 py-1.5 rounded-pill small">⏳ Loading Vision AI...</span>
          <span v-else class="badge bg-success bg-opacity-75 px-3 py-1.5 rounded-pill small">✅ 3D Face Landmarker Ready</span>
        </div>
      </div>

      <!-- Preview Stage -->
      <div class="ai-preview-stage rounded-4 p-4 text-center d-flex flex-column align-items-center justify-content-center position-relative">
        <!-- Live Video Mode (v-show preserves DOM reference for video stream) -->
        <div v-show="isCameraActive" class="w-100 position-relative d-flex flex-column align-items-center">
          <div class="ai-video-wrapper position-relative rounded-4 overflow-hidden shadow-lg">
            <video
              ref="videoEl"
              autoplay
              playsinline
              muted
              class="ai-video-feed"
            ></video>
            <canvas ref="liveCanvasEl" class="ai-live-canvas"></canvas>
            
            <div class="ai-video-hud">
              <span class="hud-status-dot" :class="{ 'hud-active': isTracking }"></span>
              {{ isTracking ? 'Face Detected & 3D Tracking Active' : (cameraLoading ? 'Starting Camera...' : 'Align your face inside the frame') }}
            </div>
          </div>

          <div v-if="cameraLoading" class="text-info small mt-2 d-flex align-items-center gap-2">
            <div class="spinner-border spinner-border-sm text-info" role="status"></div>
            <span>Accessing your webcam...</span>
          </div>

          <div class="mt-3 d-flex gap-2 justify-content-center flex-wrap">
            <button
              type="button"
              class="btn btn-primary rounded-pill px-4 py-2 font-weight-700 shadow d-inline-flex align-items-center gap-2"
              :disabled="cameraLoading"
              @click="captureAndAnalyze"
            >
              <span>📸</span> Capture & Analyze Face
            </button>
            <button
              type="button"
              class="btn btn-secondary rounded-pill px-3 py-2 small"
              @click="stopCamera"
            >
              ✕ Cancel
            </button>
          </div>
        </div>

        <!-- Default Inactive Stage Buttons -->
        <div v-show="!isCameraActive" class="py-4">
          <div class="ai-hero-icon mb-3">
            <span>📷</span>
          </div>
          <h4 class="fs-5 font-weight-700 text-white mb-1">Select an Image Source</h4>
          <p class="small text-muted-custom mb-4" style="max-width: 440px; margin: 0 auto; line-height: 1.6;">
            Look directly forward with neutral expression for the most precise facial landmark and bridge measurement.
          </p>

          <div v-if="cameraError" class="alert alert-danger bg-danger bg-opacity-25 border-danger text-white small rounded-3 mx-auto mb-3" style="max-width: 480px;">
            ⚠️ {{ cameraError }}
          </div>

          <div class="d-flex gap-3 justify-content-center flex-wrap">
            <button
              type="button"
              class="btn btn-primary rounded-pill px-4 py-2.5 font-weight-700 shadow-lg d-inline-flex align-items-center gap-2"
              :disabled="modelLoading || cameraLoading"
              @click="startCamera"
            >
              <span>📷</span> Open Camera
            </button>
            <button
              type="button"
              class="btn btn-secondary rounded-pill px-4 py-2.5 font-weight-700 d-inline-flex align-items-center gap-2"
              :disabled="modelLoading || cameraLoading"
              @click="triggerUpload"
            >
              <span>📁</span> Upload Photo
            </button>
            <input
              ref="fileInputEl"
              type="file"
              accept="image/*"
              class="d-none"
              @change="handleFileUpload"
            />
          </div>
        </div>
      </div>

      <!-- Manual Selection Fallback -->
      <div class="ai-manual-fallback mt-4 pt-3 border-top border-secondary border-opacity-25 text-center">
        <span class="small text-muted-custom d-block mb-2">Or analyze recommendations by selecting your face shape directly:</span>
        <div class="d-flex gap-2 justify-content-center flex-wrap">
          <select v-model="manualShape" class="form-select form-select-sm w-auto rounded-pill px-3 bg-dark text-white border-secondary">
            <option value="">— Select Face Shape —</option>
            <option value="Oval">🥚 Oval (Balanced & Versatile)</option>
            <option value="Round">🔵 Round (Soft Circular Curves)</option>
            <option value="Square">⬜ Square (Strong Angular Jaw)</option>
            <option value="Heart">💜 Heart (Broad Forehead, Pointed Chin)</option>
            <option value="Diamond">💎 Diamond (High Cheekbones)</option>
            <option value="Oblong">📏 Oblong (Long Proportions)</option>
          </select>
          <button
            type="button"
            class="btn btn-secondary btn-sm rounded-pill px-4"
            :disabled="!manualShape"
            @click="submitManualShape"
          >
            Analyze Frame Matches
          </button>
        </div>
      </div>
    </div>

    <!-- PROCESSING STATE -->
    <div v-if="step === 'processing'" class="glass-panel text-center py-5 rounded-4 mb-4">
      <div class="spinner-border text-info mb-3" style="width: 3rem; height: 3rem;" role="status"></div>
      <h3 class="fs-4 text-white font-weight-700 mb-2">Analyzing Facial Geometry with Gemini AI...</h3>
      <p class="small text-muted-custom mx-auto" style="max-width: 480px; line-height: 1.6;">
        Processing 468 3D facial landmarks from MediaPipe to determine your facial height-to-width ratio, jawline structure, and generate personalized frame harmony advice.
      </p>
    </div>

    <!-- RESULTS PANEL -->
    <div v-if="step === 'results'" class="ai-results-wrapper">
      <!-- Shape & Gemini Explanation Card -->
      <div class="glass-panel p-4 rounded-4 mb-4 ai-results-hero-card">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
          <div class="d-flex align-items-center gap-3">
            <div class="ai-shape-icon-wrap">
              <span>🎯</span>
            </div>
            <div>
              <span class="small font-weight-700 text-uppercase text-info">Facial Analysis Complete</span>
              <h3 class="fs-3 font-weight-800 text-white mb-0">{{ detectedShape }} Face Shape</h3>
            </div>
          </div>

          <button type="button" class="btn btn-secondary btn-sm rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2" @click="resetToCapture">
            <span>🔄</span> Retake / Test Another
          </button>
        </div>

        <!-- Snapshot Preview Thumbnail (if photo captured) -->
        <div v-if="capturedImagePreview" class="d-flex align-items-center gap-3 p-3 rounded-3 mb-3 bg-dark bg-opacity-50 border border-white border-opacity-10">
          <div class="ai-captured-preview-thumb">
            <img :src="capturedImagePreview" alt="Analyzed Face Snapshot" />
          </div>
          <div>
            <span class="small font-weight-700 text-white d-block">Portrait Analyzed</span>
            <span class="small text-muted-custom">
              Proportion Index: <strong>{{ calculatedMetrics ? calculatedMetrics.ratio : '1.20' }}</strong> • Jawline Ratio: <strong>{{ calculatedMetrics ? calculatedMetrics.jawRatio : '0.78' }}</strong>
            </span>
          </div>
        </div>

        <!-- Gemini AI Optical Explanation Box -->
        <div class="ai-explanation-box p-4 rounded-3 mb-4">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="fs-5">✨</span>
            <h4 class="small font-weight-700 text-info text-uppercase mb-0">
              {{ recommendationSource === 'gemini' ? 'Gemini AI Optical Match & Styling Explanation' : 'Optical Match & Styling Guidance' }}
            </h4>
          </div>
          <p class="text-white-90 mb-0" style="line-height: 1.7; font-size: 0.95rem;">
            {{ stylistExplanation }}
          </p>
        </div>

        <!-- Ideal Frame Geometries -->
        <div>
          <span class="small font-weight-700 text-uppercase text-muted-custom d-block mb-2">Ideal Frame Silhouettes For You</span>
          <div class="d-flex gap-2 flex-wrap">
            <span v-for="tag in idealShapes" :key="tag" class="frame-tag tag-shape">🔷 {{ tag }}</span>
          </div>
        </div>
      </div>

      <!-- Recommended Matches Section -->
      <div class="mb-4">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <h3 class="fs-4 font-weight-700 text-white mb-0">
            Recommended Frames for {{ detectedShape }} Face ({{ matchingFrames.length }} Styles)
          </h3>
          <a href="/customer/frame-catalog" class="btn btn-secondary btn-sm rounded-pill px-3">
            👓 View Entire Catalog
          </a>
        </div>

        <div v-if="matchingFrames.length > 0" class="frame-catalog-grid">
          <div
            v-for="frame in matchingFrames"
            :key="frame.id"
            class="frame-card glass-panel"
          >
            <div class="frame-card-image-wrap">
              <img :src="frame.image_url" :alt="frame.name" class="frame-card-img" @error="handleImgError" />
              <span :class="['availability-badge', frame.availability ? 'badge-in-stock' : 'badge-out-of-stock']">
                ● {{ frame.availability ? 'In Stock' : 'Out of Stock' }}
              </span>
            </div>
            <div class="frame-card-body p-3 d-flex flex-column flex-grow-1 gap-2">
              <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <h4 class="frame-card-title fs-6 font-weight-700 text-white mb-0">{{ frame.name }}</h4>
                  <span class="frame-card-brand small text-muted-custom">{{ frame.brand }}</span>
                </div>
                <span class="frame-card-price fs-6 font-weight-800 text-secondary-custom">৳{{ Number(frame.price).toFixed(2) }}</span>
              </div>

              <div class="d-flex gap-2 flex-wrap">
                <span v-if="frame.shape" class="frame-tag tag-shape">🔷 {{ frame.shape }}</span>
                <span v-if="frame.material" class="frame-tag tag-material">💎 {{ frame.material }}</span>
                <span v-if="frame.color" class="frame-tag tag-color">🎨 {{ frame.color }}</span>
              </div>

              <div class="d-flex gap-2 pt-2 border-top border-secondary border-opacity-25 mt-auto">
                <a :href="`/customer/frame-details/${frame.id}`" class="btn btn-secondary btn-sm flex-grow-1 rounded-pill">
                  Details
                </a>
                <a :href="`/customer/virtual-try-on?frameId=${frame.id}`" class="btn btn-primary btn-sm rounded-pill px-3 d-inline-flex align-items-center gap-1" title="Try On">
                  <span>📸</span> Try On
                </a>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="glass-panel text-center py-5 rounded-4">
          <p class="text-white-50 mb-0">No matching frames currently in stock for this shape. Explore our full catalog to discover alternative styles!</p>
          <a href="/customer/frame-catalog" class="btn btn-primary rounded-pill px-4 py-2 mt-3">Browse Catalog</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  catalogFrames: {
    type: Array,
    default: () => []
  }
});

const step = ref('capture'); // 'capture' | 'processing' | 'results'
const isCameraActive = ref(false);
const isTracking = ref(false);
const modelLoading = ref(true);
const cameraLoading = ref(false);
const cameraError = ref(null);

const videoEl = ref(null);
const liveCanvasEl = ref(null);
const fileInputEl = ref(null);

const manualShape = ref('');
const detectedShape = ref('Oval');
const stylistExplanation = ref('');
const recommendationSource = ref('fallback');
const apiFrames = ref([]);
const capturedImagePreview = ref(null);
const calculatedMetrics = ref(null);

let cameraStream = null;
let liveAnimationId = null;
let faceLandmarkerInstance = null;
let landmarkerReady = false;

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
    console.warn('FaceLandmarker GPU init failed, trying CPU fallback:', err);
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
      console.error('FaceLandmarker initialization error:', fallbackErr);
      modelLoading.value = false;
      return null;
    }
  }
}

// Calibrated Face Shape Classifier from 468 MediaPipe Landmarks
function classifyLandmarks(landmarks, canvasW = 640, canvasH = 480) {
  if (!landmarks || landmarks.length < 468) {
    return {
      shape: 'Oval',
      metrics: { ratio: 1.20, jawRatio: 0.78, foreheadRatio: 0.86, lowerJawRatio: 0.65 }
    };
  }

  // 10: Forehead top, 152: Chin bottom
  // 54, 284: Forehead breadth
  // 234, 454: Cheekbone / face breadth
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

  const ratio = parseFloat((faceHeight / faceWidth).toFixed(2));
  const jawRatio = parseFloat((jawWidth / faceWidth).toFixed(2));
  const foreheadRatio = parseFloat((foreheadWidth / faceWidth).toFixed(2));
  const lowerJawRatio = parseFloat((jawRatio * 0.82).toFixed(2));

  let shape = 'Oval';

  if (ratio >= 1.25) {
    if (jawRatio > 0.84) shape = 'Oblong';
    else shape = 'Oval';
  } else if (ratio >= 1.10) {
    if (jawRatio > 0.88 && foreheadRatio > 0.88) shape = 'Square';
    else if (foreheadRatio > 0.88 && jawRatio < 0.74) shape = 'Heart';
    else if (foreheadRatio < 0.80 && jawRatio < 0.74) shape = 'Diamond';
    else shape = 'Oval';
  } else {
    if (jawRatio > 0.86) shape = 'Square';
    else shape = 'Round';
  }

  return {
    shape,
    metrics: { ratio, jawRatio, foreheadRatio, lowerJawRatio }
  };
}

const idealShapes = computed(() => {
  if (detectedShape.value === 'Round') return ['Square', 'Rectangular', 'Geometric', 'Wayfarer'];
  if (detectedShape.value === 'Square') return ['Round', 'Oval', 'Aviator', 'Cat-Eye'];
  if (detectedShape.value === 'Heart') return ['Oval', 'Cat-Eye', 'Rimless', 'Browline'];
  if (detectedShape.value === 'Diamond') return ['Cat-Eye', 'Oval', 'Browline', 'Round'];
  if (detectedShape.value === 'Oblong') return ['Round', 'Square', 'Aviator', 'Browline'];
  return ['Aviator', 'Rectangular', 'Round', 'Browline', 'Geometric'];
});

const matchingFrames = computed(() => {
  if (apiFrames.value && apiFrames.value.length > 0) {
    return apiFrames.value;
  }
  const shapes = idealShapes.value.map(s => s.toLowerCase());
  return props.catalogFrames.filter(f => f.shape && shapes.includes(f.shape.toLowerCase()));
});

function handleImgError(e) {
  e.target.src = 'https://placehold.co/320x200/1a1a2e/a78bfa?text=🕶️+Frame';
}

// Live Camera Loop
let lastTime = -1;
function renderLiveStreamLoop() {
  if (!isCameraActive.value || !videoEl.value) return;

  const video = videoEl.value;
  const canvas = liveCanvasEl.value;

  if (video.readyState >= 2 && canvas) {
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (faceLandmarkerInstance && landmarkerReady) {
      if (video.currentTime !== lastTime) {
        lastTime = video.currentTime;
        try {
          const results = faceLandmarkerInstance.detectForVideo(video, performance.now());
          if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            isTracking.value = true;
            // Draw subtle facial landmark guide points
            const landmarks = results.faceLandmarks[0];
            ctx.fillStyle = 'rgba(124, 58, 237, 0.7)';
            [10, 152, 234, 454, 33, 263, 168].forEach(idx => {
              const pt = landmarks[idx];
              if (pt) {
                ctx.beginPath();
                ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 4, 0, Math.PI * 2);
                ctx.fill();
              }
            });
          } else {
            isTracking.value = false;
          }
        } catch (e) {
          // ignore transient glitch
        }
      }
    }
  }

  liveAnimationId = requestAnimationFrame(renderLiveStreamLoop);
}

async function startCamera() {
  cameraError.value = null;
  cameraLoading.value = true;
  isCameraActive.value = true;

  try {
    await nextTick();
    await initFaceLandmarker();

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: false
    });

    if (videoEl.value) {
      videoEl.value.srcObject = cameraStream;
      await videoEl.value.play();
      cancelAnimationFrame(liveAnimationId);
      liveAnimationId = requestAnimationFrame(renderLiveStreamLoop);
    }
  } catch (err) {
    console.error('Camera activation failed:', err);
    cameraError.value = 'Unable to access your webcam. Please verify camera permissions in your browser.';
    isCameraActive.value = false;
  } finally {
    cameraLoading.value = false;
  }
}

function stopCamera() {
  if (liveAnimationId) {
    cancelAnimationFrame(liveAnimationId);
    liveAnimationId = null;
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  if (videoEl.value) {
    videoEl.value.srcObject = null;
  }
  isCameraActive.value = false;
  isTracking.value = false;
  cameraLoading.value = false;
}

// Fetch Gemini AI Optical Analysis
async function requestAiRecommendation(shape, metrics) {
  step.value = 'processing';
  try {
    const res = await fetch('/customer/ai-recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ faceShape: shape, metrics })
    });
    const data = await res.json();
    if (data.success) {
      detectedShape.value = data.faceShape || shape;
      stylistExplanation.value = data.explanation || '';
      recommendationSource.value = data.source || 'fallback';
      if (data.frames && data.frames.length > 0) {
        apiFrames.value = data.frames;
      }
    } else {
      throw new Error(data.error || 'Failed to fetch AI recommendation');
    }
  } catch (err) {
    console.warn('AI recommendation fetch failed, using fallback:', err);
    detectedShape.value = shape;
    recommendationSource.value = 'fallback';
    stylistExplanation.value = `Your ${shape} face shape features balanced proportions that pair wonderfully with geometric and structured silhouettes!`;
  } finally {
    step.value = 'results';
  }
}

async function captureAndAnalyze() {
  if (!videoEl.value) return;
  const video = videoEl.value;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = video.videoWidth || 640;
  tempCanvas.height = video.videoHeight || 480;
  const ctx = tempCanvas.getContext('2d');
  
  // Flip horizontally so snapshot matches mirrored camera preview
  ctx.save();
  ctx.translate(tempCanvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
  ctx.restore();

  capturedImagePreview.value = tempCanvas.toDataURL('image/jpeg', 0.92);
  stopCamera();

  // Run landmark classification on captured frame
  let resultShape = 'Oval';
  let metrics = { ratio: 1.20, jawRatio: 0.78, foreheadRatio: 0.86, lowerJawRatio: 0.65 };

  if (faceLandmarkerInstance) {
    try {
      await faceLandmarkerInstance.setOptions({ runningMode: 'IMAGE' });
      const results = faceLandmarkerInstance.detect(tempCanvas);
      await faceLandmarkerInstance.setOptions({ runningMode: 'VIDEO' });

      if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
        const classified = classifyLandmarks(results.faceLandmarks[0], tempCanvas.width, tempCanvas.height);
        resultShape = classified.shape;
        metrics = classified.metrics;
      }
    } catch (e) {
      console.warn('Capture landmark classification error:', e);
    }
  }

  calculatedMetrics.value = metrics;
  await requestAiRecommendation(resultShape, metrics);
}

function triggerUpload() {
  if (fileInputEl.value) {
    fileInputEl.value.click();
  }
}

function handleFileUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    capturedImagePreview.value = event.target.result;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      let resultShape = 'Oval';
      let metrics = { ratio: 1.20, jawRatio: 0.78, foreheadRatio: 0.86, lowerJawRatio: 0.65 };

      if (faceLandmarkerInstance) {
        try {
          await faceLandmarkerInstance.setOptions({ runningMode: 'IMAGE' });
          const results = faceLandmarkerInstance.detect(img);
          await faceLandmarkerInstance.setOptions({ runningMode: 'VIDEO' });

          if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            const classified = classifyLandmarks(results.faceLandmarks[0], img.naturalWidth, img.naturalHeight);
            resultShape = classified.shape;
            metrics = classified.metrics;
          }
        } catch (e) {
          console.warn('Image file classification error:', e);
        }
      }

      calculatedMetrics.value = metrics;
      await requestAiRecommendation(resultShape, metrics);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

async function submitManualShape() {
  if (!manualShape.value) return;
  capturedImagePreview.value = null;
  calculatedMetrics.value = null;
  await requestAiRecommendation(manualShape.value, { ratio: 1.20, jawRatio: 0.78, foreheadRatio: 0.86, lowerJawRatio: 0.65 });
}

function resetToCapture() {
  step.value = 'capture';
  manualShape.value = '';
  capturedImagePreview.value = null;
  apiFrames.value = [];
  recommendationSource.value = 'fallback';
}

onMounted(() => {
  initFaceLandmarker();
});

onBeforeUnmount(() => {
  stopCamera();
});
</script>

<style scoped>
.ai-recommendations-root {
  width: 100%;
}

.ai-preview-stage {
  min-height: 380px;
  background: rgba(2, 6, 23, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.ai-hero-icon {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: rgba(124, 58, 237, 0.2);
  border: 1px solid rgba(167, 139, 250, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  margin: 0 auto;
}

.ai-video-wrapper {
  max-width: 640px;
  width: 100%;
  min-height: 360px;
  max-height: 440px;
  background: #020617;
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-video-feed {
  width: 100%;
  height: 100%;
  min-height: 360px;
  max-height: 440px;
  object-fit: cover;
  transform: scaleX(-1);
  display: block;
}

.ai-live-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: scaleX(-1);
  pointer-events: none;
}

.ai-video-hud {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(8px);
  padding: 0.4rem 1rem;
  border-radius: 50px;
  font-size: 0.8rem;
  color: #e2e8f0;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
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

.ai-results-hero-card {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.18), rgba(20, 184, 166, 0.1));
  border: 1px solid rgba(167, 139, 250, 0.35);
}

.ai-shape-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: rgba(124, 58, 237, 0.3);
  border: 1px solid rgba(167, 139, 250, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
}

.ai-captured-preview-thumb {
  width: 58px;
  height: 58px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.ai-captured-preview-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ai-explanation-box {
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(124, 58, 237, 0.3);
}

.text-white-90 {
  color: rgba(255, 255, 255, 0.92);
}
</style>
