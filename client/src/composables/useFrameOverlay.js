import { ref } from 'vue';

const HINGE_PROFILES = Object.freeze({
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
});

const FRAME_COLOR_MAP = Object.freeze({
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
});

export function useFrameOverlay() {
  const overlayLoaded = ref(false);
  const overlayImage = new Image();
  overlayImage.crossOrigin = 'anonymous';

  overlayImage.onload = () => {
    overlayLoaded.value = true;
  };

  function resolveOverlayUrl(frame) {
    if (!frame || !frame.image_url) return '';
    return /\/(?:round|titan)\.png$/i.test(frame.image_url)
      ? frame.image_url.replace(/\.png$/i, '_front.svg')
      : frame.image_url.replace(/\.png$/i, '_overlay.png');
  }

  function loadOverlay(frame) {
    overlayLoaded.value = false;
    if (frame && frame.image_url) {
      const url = resolveOverlayUrl(frame);
      overlayImage.src = url;
    }
  }

  function getHingeProfile(frame) {
    if (!frame) return HINGE_PROFILES.default;
    const key = ((frame.shape || '') + ' ' + (frame.name || '')).toLowerCase();
    for (const [name, prof] of Object.entries(HINGE_PROFILES)) {
      if (key.includes(name)) return prof;
    }
    return HINGE_PROFILES.default;
  }

  function resolveColor(colorName) {
    if (!colorName) return '#2a2a2c';
    return FRAME_COLOR_MAP[colorName.toLowerCase()] || '#2a2a2c';
  }

  function drawGlasses(ctx, landmarks, frame, canvasW, canvasH, activeTintHex = 'transparent') {
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
    const angle = Math.atan2(dy, dx);

    const bridgeX = (noseBridge ? noseBridge.x : (leftEye.x + rightEye.x) / 2) * canvasW;
    const bridgeY = (noseBridge ? noseBridge.y : (leftEye.y + rightEye.y) / 2) * canvasH;

    const faceWidthAtTemples = (leftEar && rightEar)
      ? Math.hypot((rightEar.x - leftEar.x) * canvasW, (rightEar.y - leftEar.y) * canvasH)
      : eyeDistance * 1.45;

    const frameWidth = Math.min(eyeDistance * 1.58, faceWidthAtTemples * 1.02);
    const aspect = (overlayImage.naturalHeight && overlayImage.naturalWidth)
      ? (overlayImage.naturalHeight / overlayImage.naturalWidth)
      : 0.38;
    const frameHeight = frameWidth * aspect;
    const frameCenterY = bridgeY + frameHeight * 0.02;

    const templeColor = resolveColor(frame.color);
    const hingeProfile = getHingeProfile(frame);

    const leftHingeLocalX = (hingeProfile.leftHinge.x - 0.5) * frameWidth;
    const leftHingeLocalY = (hingeProfile.leftHinge.y - 0.5) * frameHeight;
    const rightHingeLocalX = (hingeProfile.rightHinge.x - 0.5) * frameWidth;
    const rightHingeLocalY = (hingeProfile.rightHinge.y - 0.5) * frameHeight;

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const leftHingeX = bridgeX + (leftHingeLocalX * cosA - leftHingeLocalY * sinA);
    const leftHingeY = frameCenterY + (leftHingeLocalX * sinA + leftHingeLocalY * cosA);
    const rightHingeX = bridgeX + (rightHingeLocalX * cosA - rightHingeLocalY * sinA);
    const rightHingeY = frameCenterY + (rightHingeLocalX * sinA + rightHingeLocalY * cosA);

    const leftEarX = leftEar.x * canvasW;
    const leftEarY = leftEar.y * canvasH;
    const rightEarX = rightEar.x * canvasW;
    const rightEarY = rightEar.y * canvasH;

    // 1. Draw Temples behind front frame
    ctx.save();
    ctx.strokeStyle = templeColor;
    ctx.lineWidth = Math.max(2, frameWidth * 0.02);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 3;

    ctx.beginPath();
    ctx.moveTo(leftHingeX, leftHingeY);
    ctx.quadraticCurveTo(
      leftHingeX * 0.45 + leftEarX * 0.55,
      leftHingeY * 0.45 + leftEarY * 0.55 - frameHeight * 0.04,
      leftEarX,
      leftEarY
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightHingeX, rightHingeY);
    ctx.quadraticCurveTo(
      rightHingeX * 0.45 + rightEarX * 0.55,
      rightHingeY * 0.45 + rightEarY * 0.55 - frameHeight * 0.04,
      rightEarX,
      rightEarY
    );
    ctx.stroke();
    ctx.restore();

    // 2. Draw Front Frame overlay
    ctx.save();
    ctx.translate(bridgeX, frameCenterY);
    ctx.rotate(angle);

    if (overlayLoaded.value && overlayImage.complete && overlayImage.naturalWidth > 0) {
      ctx.drawImage(overlayImage, -frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight);

      if (activeTintHex && activeTintHex !== 'transparent') {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = activeTintHex;
        ctx.fillRect(-frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight);
        ctx.restore();
      }
    } else {
      // Wireframe fallback
      ctx.strokeStyle = templeColor;
      ctx.lineWidth = 3;
      const lensR = eyeDistance * 0.42;
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

  return {
    overlayLoaded,
    overlayImage,
    loadOverlay,
    resolveOverlayUrl,
    getHingeProfile,
    resolveColor,
    drawGlasses
  };
}
