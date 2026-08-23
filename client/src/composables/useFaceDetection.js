import { ref } from 'vue';

export function useFaceDetection() {
  const modelLoading = ref(true);
  const isTracking = ref(false);
  const detectedShape = ref(null);
  const confidenceScore = ref(0.92);

  let faceLandmarkerInstance = null;
  let landmarkerReady = false;
  let smoothedLandmarks = null;
  let consecutiveMisses = 0;

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
      console.warn('GPU face landmarker failed, falling back to CPU:', err);
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

  function smoothLandmarks(rawLandmarks, alpha = 0.45) {
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

  function detectForVideo(videoElement, timestamp) {
    if (!faceLandmarkerInstance || !landmarkerReady || !videoElement || videoElement.readyState < 2) {
      return null;
    }

    try {
      const results = faceLandmarkerInstance.detectForVideo(videoElement, timestamp);
      if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
        isTracking.value = true;
        consecutiveMisses = 0;
        const smoothed = smoothLandmarks(results.faceLandmarks[0]);
        estimateFaceShape(smoothed);
        return smoothed;
      } else {
        consecutiveMisses++;
        if (consecutiveMisses > 6) {
          isTracking.value = false;
          smoothedLandmarks = null;
        }
        return smoothedLandmarks;
      }
    } catch (e) {
      return smoothedLandmarks;
    }
  }

  async function detectForImage(imageElement) {
    if (!faceLandmarkerInstance) await initFaceLandmarker();
    if (!faceLandmarkerInstance) return null;

    try {
      await faceLandmarkerInstance.setOptions({ runningMode: 'IMAGE' });
      const results = faceLandmarkerInstance.detect(imageElement);
      await faceLandmarkerInstance.setOptions({ runningMode: 'VIDEO' });

      if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        estimateFaceShape(landmarks);
        return landmarks;
      }
      return null;
    } catch (err) {
      console.warn('Image face detection error:', err);
      return null;
    }
  }

  function estimateFaceShape(landmarks) {
    if (!landmarks || landmarks.length < 468) return;
    if (detectedShape.value) return; // Keep cached classification for stability

    const forehead = landmarks[10];
    const chin = landmarks[152];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];

    if (!forehead || !chin || !leftCheek || !rightCheek) return;

    const faceHeight = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);
    const faceWidth = Math.hypot(rightCheek.x - leftCheek.x, rightCheek.y - leftCheek.y);
    const ratio = faceHeight / (faceWidth || 1);

    if (ratio > 1.5) detectedShape.value = 'Oblong';
    else if (ratio > 1.35) detectedShape.value = 'Oval';
    else if (ratio < 1.15) detectedShape.value = 'Round';
    else detectedShape.value = 'Square';
  }

  function resetSmoothing() {
    smoothedLandmarks = null;
    isTracking.value = false;
  }

  return {
    modelLoading,
    isTracking,
    detectedShape,
    confidenceScore,
    initFaceLandmarker,
    detectForVideo,
    detectForImage,
    resetSmoothing
  };
}
