(function (root, factory) {
    const virtualMirror = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = virtualMirror;
    }

    if (root) {
        root.VirtualMirror = virtualMirror;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DEFAULT_MAX_FPS = 30;
    const DEFAULT_SMOOTHING_ALPHA = 0.45;
    const DEFAULT_MISS_TOLERANCE = 2;
    const MIN_TIMESTAMP_STEP = 0.001;

    function requirePositiveDimension(value, name) {
        const number = Number(value);
        if (!Number.isFinite(number) || number <= 0) {
            throw new RangeError(`${name} must be a finite number greater than zero.`);
        }
        return number;
    }

    /**
     * Return the scale and centered crop used by CSS `object-fit: cover`.
     * Offsets are negative on an axis whose rendered image is cropped.
     */
    function computeCoverTransform(sourceW, sourceH, targetW, targetH) {
        const sourceWidth = requirePositiveDimension(sourceW, 'sourceW');
        const sourceHeight = requirePositiveDimension(sourceH, 'sourceH');
        const targetWidth = requirePositiveDimension(targetW, 'targetW');
        const targetHeight = requirePositiveDimension(targetH, 'targetH');
        const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
        const renderedWidth = sourceWidth * scale;
        const renderedHeight = sourceHeight * scale;

        return {
            scale,
            offsetX: (targetWidth - renderedWidth) / 2,
            offsetY: (targetHeight - renderedHeight) / 2,
            renderedWidth,
            renderedHeight,
            sourceWidth,
            sourceHeight,
            targetWidth,
            targetHeight
        };
    }

    /**
     * Map MediaPipe's normalized source coordinates into normalized coordinates
     * for a target that displays the source with `object-fit: cover`.
     */
    function mapLandmarksForCover(landmarks, sourceW, sourceH, targetW, targetH) {
        if (!Array.isArray(landmarks)) {
            throw new TypeError('landmarks must be an array.');
        }

        const transform = computeCoverTransform(sourceW, sourceH, targetW, targetH);

        return landmarks.map((landmark, index) => {
            if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) {
                throw new TypeError(`landmark at index ${index} must contain finite x and y coordinates.`);
            }

            return {
                ...landmark,
                x: ((landmark.x * transform.sourceWidth * transform.scale) + transform.offsetX)
                    / transform.targetWidth,
                y: ((landmark.y * transform.sourceHeight * transform.scale) + transform.offsetY)
                    / transform.targetHeight
            };
        });
    }

    /**
     * Exponential moving average where alpha is the weight of the current frame.
     * Non-coordinate metadata is copied from the current landmark.
     */
    function smoothLandmarks(current, previous, alpha) {
        if (!Array.isArray(current)) {
            throw new TypeError('current landmarks must be an array.');
        }
        if (previous != null && !Array.isArray(previous)) {
            throw new TypeError('previous landmarks must be an array when supplied.');
        }

        const numericAlpha = Number(alpha);
        const weight = Number.isFinite(numericAlpha)
            ? Math.min(1, Math.max(0, numericAlpha))
            : DEFAULT_SMOOTHING_ALPHA;

        return current.map((landmark, index) => {
            if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) {
                throw new TypeError(`current landmark at index ${index} must contain finite x and y coordinates.`);
            }

            const prior = previous && previous[index];
            if (!prior || !Number.isFinite(prior.x) || !Number.isFinite(prior.y)) {
                return { ...landmark };
            }

            const smoothed = {
                ...landmark,
                x: prior.x + ((landmark.x - prior.x) * weight),
                y: prior.y + ((landmark.y - prior.y) * weight)
            };

            if (Number.isFinite(landmark.z) && Number.isFinite(prior.z)) {
                smoothed.z = prior.z + ((landmark.z - prior.z) * weight);
            }

            return smoothed;
        });
    }

    function defaultNow() {
        if (typeof globalThis !== 'undefined'
            && globalThis.performance
            && typeof globalThis.performance.now === 'function') {
            return globalThis.performance.now();
        }
        return Date.now();
    }

    function defaultRequestFrame(callback) {
        if (typeof globalThis !== 'undefined'
            && typeof globalThis.requestAnimationFrame === 'function') {
            return globalThis.requestAnimationFrame(callback);
        }
        return setTimeout(() => callback(defaultNow()), 16);
    }

    function defaultCancelFrame(handle) {
        if (typeof globalThis !== 'undefined'
            && typeof globalThis.cancelAnimationFrame === 'function') {
            globalThis.cancelAnimationFrame(handle);
            return;
        }
        clearTimeout(handle);
    }

    function finiteOr(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function createTracker(options) {
        if (!options || typeof options !== 'object') {
            throw new TypeError('Tracker options are required.');
        }

        const { video, canvas, detector, render } = options;
        if (!video) throw new TypeError('A video source is required.');
        if (!canvas || typeof canvas.getContext !== 'function') {
            throw new TypeError('A canvas with a 2D context is required.');
        }
        if (!detector || typeof detector.detectForVideo !== 'function') {
            throw new TypeError('A VIDEO-mode detector with detectForVideo() is required.');
        }
        if (typeof render !== 'function') {
            throw new TypeError('A render callback is required.');
        }

        const context = canvas.getContext('2d');
        if (!context || typeof context.clearRect !== 'function') {
            throw new TypeError('The canvas must provide a 2D context.');
        }

        const onState = typeof options.onState === 'function' ? options.onState : function () {};
        const requestFrame = typeof options.requestFrame === 'function'
            ? options.requestFrame
            : defaultRequestFrame;
        const cancelFrame = typeof options.cancelFrame === 'function'
            ? options.cancelFrame
            : defaultCancelFrame;
        const now = typeof options.now === 'function' ? options.now : null;
        const configuredFps = Number(options.maxFps);
        const maxFps = Number.isFinite(configuredFps) && configuredFps > 0
            ? configuredFps
            : DEFAULT_MAX_FPS;
        const minimumFrameInterval = 1000 / maxFps;
        const smoothingAlpha = options.smoothingAlpha == null
            ? options.alpha
            : options.smoothingAlpha;
        const configuredMisses = Number(options.missTolerance == null
            ? options.maxMisses
            : options.missTolerance);
        const missTolerance = Number.isInteger(configuredMisses) && configuredMisses >= 0
            ? configuredMisses
            : DEFAULT_MISS_TOLERANCE;

        let running = false;
        let frameHandle = null;
        let lastProcessedAt = -Infinity;
        let lastVideoTime = null;
        let lastDetectorTimestamp = -Infinity;
        let previousLandmarks = null;
        let consecutiveMisses = 0;
        let hasRendered = false;
        let state = null;

        function emitState(nextState) {
            if (state === nextState) return;
            state = nextState;
            onState(nextState);
        }

        function clearCanvas() {
            context.clearRect(0, 0, finiteOr(canvas.width, 0), finiteOr(canvas.height, 0));
            hasRendered = false;
        }

        function resetSession() {
            lastProcessedAt = -Infinity;
            lastVideoTime = null;
            previousLandmarks = null;
            consecutiveMisses = 0;
            clearCanvas();
        }

        function getPixelRatio() {
            const configuredRatio = typeof options.devicePixelRatio === 'function'
                ? options.devicePixelRatio()
                : options.devicePixelRatio;
            const ratio = Number(configuredRatio);
            return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
        }

        function getDisplaySize(pixelRatio) {
            let width = finiteOr(canvas.clientWidth, 0);
            let height = finiteOr(canvas.clientHeight, 0);

            if ((width <= 0 || height <= 0) && typeof canvas.getBoundingClientRect === 'function') {
                const rect = canvas.getBoundingClientRect();
                width = width > 0 ? width : finiteOr(rect && rect.width, 0);
                height = height > 0 ? height : finiteOr(rect && rect.height, 0);
            }

            width = width > 0 ? width : finiteOr(video.clientWidth, 0);
            height = height > 0 ? height : finiteOr(video.clientHeight, 0);
            width = width > 0 ? width : finiteOr(canvas.width, 0) / pixelRatio;
            height = height > 0 ? height : finiteOr(canvas.height, 0) / pixelRatio;
            width = width > 0 ? width : finiteOr(video.videoWidth, 0);
            height = height > 0 ? height : finiteOr(video.videoHeight, 0);

            return { width, height };
        }

        function ensureCanvasSize() {
            const pixelRatio = getPixelRatio();
            const display = getDisplaySize(pixelRatio);
            if (display.width <= 0 || display.height <= 0) return false;

            const desiredWidth = Math.max(1, Math.round(display.width * pixelRatio));
            const desiredHeight = Math.max(1, Math.round(display.height * pixelRatio));
            if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) {
                canvas.width = desiredWidth;
                canvas.height = desiredHeight;
                previousLandmarks = null;
                consecutiveMisses = 0;
                hasRendered = false;
            }
            return true;
        }

        function getTickTime(frameTimestamp) {
            const candidate = now ? now() : frameTimestamp;
            const fallback = defaultNow();
            return Math.max(0, finiteOr(candidate, fallback));
        }

        function nextDetectorTimestamp(tickTime) {
            const timestamp = lastDetectorTimestamp === -Infinity
                ? tickTime
                : Math.max(tickTime, lastDetectorTimestamp + MIN_TIMESTAMP_STEP);
            lastDetectorTimestamp = timestamp;
            return timestamp;
        }

        function processDetection(tickTime) {
            const sourceWidth = finiteOr(video.videoWidth, 0);
            const sourceHeight = finiteOr(video.videoHeight, 0);
            if (sourceWidth <= 0 || sourceHeight <= 0) {
                emitState('waiting-for-video');
                return;
            }

            if ((tickTime - lastProcessedAt) + Number.EPSILON < minimumFrameInterval) return;

            const videoTime = Number(video.currentTime);
            if (Number.isFinite(videoTime) && lastVideoTime !== null && videoTime === lastVideoTime) return;

            if (!ensureCanvasSize()) {
                emitState('waiting-for-video');
                return;
            }

            lastProcessedAt = tickTime;
            if (Number.isFinite(videoTime)) lastVideoTime = videoTime;

            const result = detector.detectForVideo(video, nextDetectorTimestamp(tickTime));
            const faceLandmarks = result
                && Array.isArray(result.faceLandmarks)
                && Array.isArray(result.faceLandmarks[0])
                ? result.faceLandmarks[0]
                : null;

            if (faceLandmarks && faceLandmarks.length > 0) {
                const mapped = mapLandmarksForCover(
                    faceLandmarks,
                    sourceWidth,
                    sourceHeight,
                    canvas.width,
                    canvas.height
                );
                const smoothed = smoothLandmarks(mapped, previousLandmarks, smoothingAlpha);
                previousLandmarks = smoothed;
                consecutiveMisses = 0;
                render(smoothed, canvas.width, canvas.height);
                hasRendered = true;
                emitState('tracking');
                return;
            }

            consecutiveMisses += 1;
            if (previousLandmarks && consecutiveMisses <= missTolerance) {
                emitState('temporarily-lost');
                return;
            }

            if (hasRendered || previousLandmarks) clearCanvas();
            previousLandmarks = null;
            emitState('searching');
        }

        function scheduleNextFrame() {
            if (!running || frameHandle !== null) return;
            frameHandle = requestFrame(tick);
        }

        function tick(frameTimestamp) {
            frameHandle = null;
            if (!running) return;

            try {
                processDetection(getTickTime(frameTimestamp));
            } catch (error) {
                consecutiveMisses += 1;
                if (consecutiveMisses > missTolerance && (hasRendered || previousLandmarks)) {
                    clearCanvas();
                    previousLandmarks = null;
                }
                emitState('error');
            } finally {
                scheduleNextFrame();
            }
        }

        function start() {
            if (running) return false;
            resetSession();
            running = true;
            emitState('running');
            scheduleNextFrame();
            return true;
        }

        function stop() {
            if (!running && frameHandle === null) return false;
            running = false;
            if (frameHandle !== null) cancelFrame(frameHandle);
            frameHandle = null;
            resetSession();
            emitState('stopped');
            return true;
        }

        return {
            start,
            stop,
            get running() {
                return running;
            }
        };
    }

    return {
        computeCoverTransform,
        mapLandmarksForCover,
        smoothLandmarks,
        createTracker
    };
}));
