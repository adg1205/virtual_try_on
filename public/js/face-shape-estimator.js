(function (root, factory) {
    const estimator = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = estimator;
    }

    if (root) {
        root.FaceShapeEstimator = estimator;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // These pairs follow MediaPipe's face-oval contour. Multiple measurements are
    // used for the forehead and cheekbones so one noisy landmark cannot determine
    // the result by itself.
    const LANDMARKS = {
        foreheadTop: 10,
        chin: 152,
        noseCenter: 1,
        leftCheek: 234,
        rightCheek: 454,
        foreheadPairs: [[54, 284], [21, 251]],
        cheekPairs: [[127, 356], [234, 454], [93, 323]],
        jawPair: [172, 397],
        lowerJawPair: [136, 365]
    };

    // Ratios are calibrated around MediaPipe's canonical face mesh. They are not
    // anthropometric photo ratios: landmark 10 is below the hairline, so using a
    // traditional 1.3+ face-height threshold incorrectly labels an average face
    // as round. Each profile considers the complete contour rather than one cutoff.
    const SHAPE_PROFILES = {
        Oval:    { aspectRatio: 1.16, foreheadRatio: 0.87, jawRatio: 0.78, lowerJawRatio: 0.66 },
        Round:   { aspectRatio: 1.03, foreheadRatio: 0.89, jawRatio: 0.83, lowerJawRatio: 0.69 },
        Square:  { aspectRatio: 1.08, foreheadRatio: 0.91, jawRatio: 0.89, lowerJawRatio: 0.76 },
        Heart:   { aspectRatio: 1.14, foreheadRatio: 0.95, jawRatio: 0.70, lowerJawRatio: 0.58 },
        Diamond: { aspectRatio: 1.17, foreheadRatio: 0.76, jawRatio: 0.72, lowerJawRatio: 0.62 },
        Oblong:  { aspectRatio: 1.32, foreheadRatio: 0.87, jawRatio: 0.80, lowerJawRatio: 0.68 }
    };

    const FEATURE_SCALES = {
        aspectRatio: 0.11,
        foreheadRatio: 0.10,
        jawRatio: 0.09,
        lowerJawRatio: 0.10
    };

    const FEATURE_WEIGHTS = {
        aspectRatio: 2.2,
        foreheadRatio: 1.3,
        jawRatio: 1.5,
        lowerJawRatio: 0.7
    };

    const PRESENTATION = {
        Oval: {
            icon: '\u{1F95A}',
            recommendation: 'Most frame styles suit an oval face. Try geometric, wayfarer, or cat-eye frames.'
        },
        Round: {
            icon: '\u{1F535}',
            recommendation: 'Angular and geometric frames add definition. Rectangular and square shapes are ideal.'
        },
        Square: {
            icon: '\u2B1C',
            recommendation: 'Round or oval frames soften angular features. Thin metal and browline styles work well.'
        },
        Heart: {
            icon: '\u{1F49C}',
            recommendation: 'Round, oval, and light-rimmed frames help balance a wider forehead and tapered jaw.'
        },
        Diamond: {
            icon: '\u{1F48E}',
            recommendation: 'Oval, browline, and cat-eye frames complement prominent cheekbones and a tapered forehead and jaw.'
        },
        Oblong: {
            icon: '\u{1F4CF}',
            recommendation: 'Wide, aviator, or oversized frames add horizontal balance to a longer face.'
        }
    };

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function asFiniteNumber(value, name) {
        const number = Number(value);
        if (!Number.isFinite(number)) {
            throw new TypeError(`Invalid ${name} supplied to the face-shape estimator.`);
        }
        return number;
    }

    function pixelDistance(a, b, imageWidth, imageHeight) {
        const dx = (b.x - a.x) * imageWidth;
        const dy = (b.y - a.y) * imageHeight;
        return Math.hypot(dx, dy);
    }

    function pairDistance(landmarks, pair, imageWidth, imageHeight) {
        return pixelDistance(landmarks[pair[0]], landmarks[pair[1]], imageWidth, imageHeight);
    }

    function average(values) {
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    function median(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[middle - 1] + sorted[middle]) / 2
            : sorted[middle];
    }

    function shapePenalty(shape, features) {
        let penalty = 0;

        // Shape-defining guardrails keep neighboring prototypes from winning on
        // one coincidental ratio while retaining a soft, score-based boundary.
        if (shape === 'Diamond') {
            if (features.foreheadRatio > 0.85) penalty += Math.pow((features.foreheadRatio - 0.85) / 0.05, 2);
            if (features.jawRatio > 0.81) penalty += Math.pow((features.jawRatio - 0.81) / 0.05, 2);
        }

        if (shape === 'Heart') {
            const foreheadAdvantage = features.foreheadRatio - features.jawRatio;
            if (foreheadAdvantage < 0.12) penalty += Math.pow((0.12 - foreheadAdvantage) / 0.06, 2);
        }

        if ((shape === 'Round' || shape === 'Square') && features.aspectRatio > 1.20) {
            penalty += Math.pow((features.aspectRatio - 1.20) / 0.06, 2);
        }

        if (shape === 'Square' && features.jawRatio < 0.82) {
            penalty += Math.pow((0.82 - features.jawRatio) / 0.05, 2);
        }

        if (shape === 'Oblong' && features.aspectRatio < 1.22) {
            penalty += Math.pow((1.22 - features.aspectRatio) / 0.06, 2);
        }

        return penalty;
    }

    function classifyMetrics(inputMetrics) {
        const features = {
            aspectRatio: asFiniteNumber(inputMetrics.aspectRatio, 'aspect ratio'),
            foreheadRatio: asFiniteNumber(inputMetrics.foreheadRatio, 'forehead ratio'),
            jawRatio: asFiniteNumber(inputMetrics.jawRatio, 'jaw ratio'),
            lowerJawRatio: asFiniteNumber(inputMetrics.lowerJawRatio, 'lower-jaw ratio')
        };
        const yawAsymmetry = Number.isFinite(Number(inputMetrics.yawAsymmetry))
            ? Math.max(0, Number(inputMetrics.yawAsymmetry))
            : 0;

        const scores = Object.entries(SHAPE_PROFILES).map(([shape, profile]) => {
            let score = 0;

            Object.keys(FEATURE_WEIGHTS).forEach(featureName => {
                const normalizedDifference = (features[featureName] - profile[featureName]) / FEATURE_SCALES[featureName];
                score += FEATURE_WEIGHTS[featureName] * normalizedDifference * normalizedDifference;
            });

            score += shapePenalty(shape, features);
            return { shape, score };
        }).sort((a, b) => a.score - b.score);

        const best = scores[0];
        const second = scores[1];
        const scoreMargin = second.score - best.score;
        const fit = Math.exp(-best.score / 5);
        const separation = 1 - Math.exp(-scoreMargin / 2.5);
        const poseFactor = 1 - clamp((yawAsymmetry - 0.06) / 0.30, 0, 0.45);
        const confidence = clamp((0.58 * fit + 0.42 * separation) * poseFactor, 0.30, 0.96);
        const presentation = PRESENTATION[best.shape];

        return {
            shape: best.shape,
            secondaryShape: second.shape,
            confidence,
            icon: presentation.icon,
            recommendation: presentation.recommendation,
            poseWarning: yawAsymmetry > 0.14
                ? 'For a more reliable result, face the camera directly and keep your head level.'
                : '',
            scores: scores.reduce((result, entry) => {
                result[entry.shape] = Number(entry.score.toFixed(3));
                return result;
            }, {})
        };
    }

    function estimate(landmarks, imageWidth, imageHeight) {
        const width = asFiniteNumber(imageWidth, 'image width');
        const height = asFiniteNumber(imageHeight, 'image height');

        if (!Array.isArray(landmarks) || landmarks.length <= LANDMARKS.rightCheek) {
            throw new TypeError('A complete MediaPipe face-landmark array is required.');
        }
        if (width <= 0 || height <= 0) {
            throw new RangeError('Image dimensions must be greater than zero.');
        }

        const faceHeight = pixelDistance(
            landmarks[LANDMARKS.foreheadTop],
            landmarks[LANDMARKS.chin],
            width,
            height
        );
        const cheekWidth = median(LANDMARKS.cheekPairs.map(pair => pairDistance(landmarks, pair, width, height)));
        const foreheadWidth = average(LANDMARKS.foreheadPairs.map(pair => pairDistance(landmarks, pair, width, height)));
        const jawWidth = pairDistance(landmarks, LANDMARKS.jawPair, width, height);
        const lowerJawWidth = pairDistance(landmarks, LANDMARKS.lowerJawPair, width, height);

        if (cheekWidth <= 0) {
            throw new RangeError('The detected face width is invalid. Please use a clearer, front-facing photo.');
        }

        const leftCheekSpan = pixelDistance(
            landmarks[LANDMARKS.noseCenter],
            landmarks[LANDMARKS.leftCheek],
            width,
            height
        );
        const rightCheekSpan = pixelDistance(
            landmarks[LANDMARKS.noseCenter],
            landmarks[LANDMARKS.rightCheek],
            width,
            height
        );
        const averageHalfWidth = (leftCheekSpan + rightCheekSpan) / 2;
        const yawAsymmetry = averageHalfWidth > 0
            ? Math.abs(leftCheekSpan - rightCheekSpan) / averageHalfWidth
            : 0;

        const numericMetrics = {
            aspectRatio: faceHeight / cheekWidth,
            foreheadRatio: foreheadWidth / cheekWidth,
            jawRatio: jawWidth / cheekWidth,
            lowerJawRatio: lowerJawWidth / cheekWidth,
            yawAsymmetry
        };
        const classification = classifyMetrics(numericMetrics);

        return {
            ...classification,
            metrics: {
                faceHeight: faceHeight.toFixed(1),
                cheekWidth: cheekWidth.toFixed(1),
                jawWidth: jawWidth.toFixed(1),
                foreheadWidth: foreheadWidth.toFixed(1),
                lowerJawWidth: lowerJawWidth.toFixed(1),
                ratio: numericMetrics.aspectRatio.toFixed(2),
                aspectRatio: numericMetrics.aspectRatio.toFixed(2),
                jawRatio: numericMetrics.jawRatio.toFixed(2),
                foreheadRatio: numericMetrics.foreheadRatio.toFixed(2),
                lowerJawRatio: numericMetrics.lowerJawRatio.toFixed(2),
                yawAsymmetry: numericMetrics.yawAsymmetry.toFixed(2),
                confidence: classification.confidence.toFixed(2),
                confidencePercent: `${Math.round(classification.confidence * 100)}%`,
                secondaryShape: classification.secondaryShape,
                poseWarning: classification.poseWarning
            }
        };
    }

    return {
        estimate,
        classifyMetrics,
        LANDMARKS,
        SHAPE_PROFILES
    };
}));
