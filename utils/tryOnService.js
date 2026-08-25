const MAX_IMAGE_DATA_LENGTH = 9 * 1024 * 1024;

function clampNumber(value, fallback, minimum, maximum) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizeOverlaySettings(value = {}) {
    let settings = value;
    if (typeof value === 'string') {
        try {
            settings = JSON.parse(value);
        } catch (_error) {
            settings = {};
        }
    }

    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        settings = {};
    }

    return {
        scale: clampNumber(settings.scale, 1, 0.75, 1.35),
        offsetX: clampNumber(settings.offsetX, 0, -0.2, 0.2),
        offsetY: clampNumber(settings.offsetY, 0, -0.2, 0.2),
        rotation: clampNumber(settings.rotation, 0, -20, 20),
        opacity: clampNumber(settings.opacity, 1, 0.35, 1)
    };
}

function validateTryOnImageData(imageData) {
    if (typeof imageData !== 'string' || !imageData.trim()) {
        return { valid: false, error: 'A final try-on image is required.' };
    }
    if (imageData.length > MAX_IMAGE_DATA_LENGTH) {
        return { valid: false, error: 'The final try-on image is too large.' };
    }
    if (!/^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=\r\n]+$/i.test(imageData)) {
        return { valid: false, error: 'The final try-on image must be a JPEG, PNG, or WebP data URL.' };
    }
    return { valid: true };
}

module.exports = {
    MAX_IMAGE_DATA_LENGTH,
    normalizeOverlaySettings,
    validateTryOnImageData
};
