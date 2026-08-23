import { ref } from 'vue';

export function useCamera() {
  const isStreaming = ref(false);
  const cameraLoading = ref(false);
  const cameraError = ref(null);
  const facingMode = ref('user');
  let currentStream = null;

  async function startCamera(videoElement, options = {}) {
    cameraLoading.value = true;
    cameraError.value = null;
    stopCamera();

    const idealWidth = options.width || 1280;
    const idealHeight = options.height || 720;
    const mode = options.facingMode || facingMode.value;

    try {
      currentStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: idealWidth },
          height: { ideal: idealHeight }
        },
        audio: false
      });

      if (videoElement) {
        videoElement.srcObject = currentStream;
        await videoElement.play();
      }
      isStreaming.value = true;
      return currentStream;
    } catch (err) {
      console.error('Camera access failed:', err);
      cameraError.value = 'Camera permission denied or camera not found. Please verify browser settings.';
      isStreaming.value = false;
      throw err;
    } finally {
      cameraLoading.value = false;
    }
  }

  function stopCamera() {
    isStreaming.value = false;
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      currentStream = null;
    }
  }

  function toggleFacingMode(videoElement, options = {}) {
    facingMode.value = facingMode.value === 'user' ? 'environment' : 'user';
    return startCamera(videoElement, { ...options, facingMode: facingMode.value });
  }

  function captureFrame(videoElement, quality = 0.95) {
    if (!videoElement || videoElement.readyState < 2) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  return {
    isStreaming,
    cameraLoading,
    cameraError,
    facingMode,
    startCamera,
    stopCamera,
    toggleFacingMode,
    captureFrame
  };
}
