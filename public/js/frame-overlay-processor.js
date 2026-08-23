(function (root, factory) {
    const processor = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = processor;
    }

    if (root) {
        root.FrameOverlayProcessor = processor;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // These two legacy assets contain a visible checker pattern inside the lenses.
    // Every other overlay already has a transparent background/lens area and must be
    // drawn unchanged so light, silver, and crystal-clear frame pixels are preserved.
    const CHECKERBOARD_OVERLAY_FILES = new Set([
        'aviator_overlay.png',
        'round_overlay.png'
    ]);
    const SQUARE_OVERLAY_FILE = 'square_overlay.png';
    const SQUARE_COLOR_LIFT = 0.70;
    const SQUARE_ALPHA_LAYERS = 2;
    const SQUARE_MAX_ALPHA = 250;
    const OVAL_OVERLAY_FILE = 'oval_overlay.png';
    const OVAL_SOURCE_TEMPLE_POLYGON = [
        [0.119, 0.452],
        [0.128, 0.475],
        [0.142, 0.502],
        [0.157, 0.532],
        [0.171, 0.562],
        [0.180, 0.586],
        [0.197, 0.590],
        [0.204, 0.574],
        [0.195, 0.548],
        [0.181, 0.516],
        [0.164, 0.484],
        [0.142, 0.454]
    ];
    const CLUBMASTER_OVERLAY_FILE = 'clubmaster_overlay.png';
    const CLUBMASTER_SOURCE_TEMPLE_POLYGON = [
        [0.141, 0.431],
        [0.148, 0.458],
        [0.162, 0.486],
        [0.178, 0.517],
        [0.195, 0.548],
        [0.208, 0.574],
        [0.220, 0.594],
        [0.238, 0.597],
        [0.252, 0.583],
        [0.249, 0.559],
        [0.233, 0.530],
        [0.216, 0.498],
        [0.198, 0.467],
        [0.177, 0.435],
        [0.154, 0.425]
    ];
    const CATEYE_OVERLAY_FILE = 'cateye_overlay.png';
    const CATEYE_SOURCE_TEMPLE_POLYGON = [
        [0.096, 0.420],
        [0.103, 0.446],
        [0.124, 0.453],
        [0.142, 0.469],
        [0.160, 0.493],
        [0.177, 0.519],
        [0.195, 0.545],
        [0.211, 0.568],
        [0.231, 0.575],
        [0.243, 0.561],
        [0.232, 0.536],
        [0.214, 0.507],
        [0.194, 0.480],
        [0.173, 0.454],
        [0.148, 0.428],
        [0.122, 0.414]
    ];
    const SPORT_OVERLAY_FILE = 'sport_overlay.png';
    const SPORT_SOURCE_TEMPLE_POLYGON = [
        [0.145, 0.435],
        [0.149, 0.458],
        [0.176, 0.479],
        [0.205, 0.500],
        [0.235, 0.522],
        [0.266, 0.544],
        [0.289, 0.548],
        [0.306, 0.534],
        [0.304, 0.511],
        [0.276, 0.488],
        [0.247, 0.467],
        [0.217, 0.446],
        [0.187, 0.427],
        [0.158, 0.421]
    ];
    const FRAME_COLOR_HEX = Object.freeze({
        gold: '#c9a54e',
        'rose gold': '#c78e86',
        silver: '#c9ccd1',
        gunmetal: '#565a5e',
        black: '#1c1c1e',
        'matte black': '#2a2a2c',
        tortoise: '#6b4423',
        'honey brown': '#b5792b',
        brown: '#5b3a1e',
        'crystal clear': '#d8dde3',
        blue: '#2c4a7c',
        navy: '#1e2a44'
    });
    const DEFAULT_FRAME_COLOR = '#3a3a3a';

    function freezeFitProfile(profile) {
        return Object.freeze({
            ...profile,
            leftHinge: Object.freeze({ ...profile.leftHinge }),
            rightHinge: Object.freeze({ ...profile.rightHinge })
        });
    }

    // Hinge points are normalized source-image coordinates measured at the physical
    // joint on each active overlay. Keeping these values per frame prevents a generic
    // offset from attaching an arm above or inside a differently shaped end piece.
    const DEFAULT_FRAME_FIT_PROFILE = freezeFitProfile({
        profileKey: 'default',
        size: 1.20,
        verticalOffset: 0.06,
        leftHinge: { x: 0.120, y: 0.420 },
        rightHinge: { x: 0.880, y: 0.420 },
        hingeX: 0.380,
        hingeY: -0.080,
        templeDrop: 0.10,
        templeWidthRatio: null
    });

    const FRAME_FIT_PROFILES = Object.freeze({
        aviator: freezeFitProfile({
            ...DEFAULT_FRAME_FIT_PROFILE,
            profileKey: 'aviator',
            leftHinge: { x: 0.103, y: 0.469 },
            rightHinge: { x: 0.897, y: 0.469 },
            hingeX: 0.397,
            hingeY: -0.031,
            templeWidthRatio: 0.014
        }),
        wayfarer: freezeFitProfile({
            ...DEFAULT_FRAME_FIT_PROFILE,
            profileKey: 'wayfarer',
            leftHinge: { x: 0.102, y: 0.425 },
            rightHinge: { x: 0.898, y: 0.425 },
            hingeX: 0.398,
            hingeY: -0.075,
            templeWidthRatio: 0.035
        }),
        round: freezeFitProfile({
            ...DEFAULT_FRAME_FIT_PROFILE,
            profileKey: 'round',
            leftHinge: { x: 0.109, y: 0.493 },
            rightHinge: { x: 0.891, y: 0.493 },
            hingeX: 0.391,
            hingeY: -0.007,
            templeWidthRatio: 0.012
        }),
        clubmaster: freezeFitProfile({
            ...DEFAULT_FRAME_FIT_PROFILE,
            profileKey: 'clubmaster',
            leftHinge: { x: 0.101, y: 0.408 },
            rightHinge: { x: 0.899, y: 0.408 },
            hingeX: 0.399,
            hingeY: -0.092,
            templeWidthRatio: 0.035
        }),
        titan: freezeFitProfile({
            ...DEFAULT_FRAME_FIT_PROFILE,
            profileKey: 'titan',
            size: 1.13,
            verticalOffset: 0.035,
            leftHinge: { x: 0.102, y: 0.449 },
            rightHinge: { x: 0.898, y: 0.449 },
            hingeX: 0.398,
            hingeY: -0.051,
            templeDrop: 0.02,
            templeWidthRatio: 0.008
        }),
        cateye: freezeFitProfile({
            ...DEFAULT_FRAME_FIT_PROFILE,
            profileKey: 'cateye',
            leftHinge: { x: 0.071, y: 0.438 },
            rightHinge: { x: 0.929, y: 0.438 },
            hingeX: 0.429,
            hingeY: -0.062,
            templeWidthRatio: 0.014
        }),
        geometric: freezeFitProfile({
            ...DEFAULT_FRAME_FIT_PROFILE,
            profileKey: 'geometric',
            leftHinge: { x: 0.067, y: 0.454 },
            rightHinge: { x: 0.933, y: 0.454 },
            hingeX: 0.433,
            hingeY: -0.046,
            templeWidthRatio: 0.042
        }),
        oval: freezeFitProfile({
            ...DEFAULT_FRAME_FIT_PROFILE,
            profileKey: 'oval',
            leftHinge: { x: 0.097, y: 0.428 },
            rightHinge: { x: 0.903, y: 0.428 },
            hingeX: 0.403,
            hingeY: -0.072,
            templeWidthRatio: 0.035
        }),
        sport: freezeFitProfile({
            ...DEFAULT_FRAME_FIT_PROFILE,
            profileKey: 'sport',
            leftHinge: { x: 0.098, y: 0.439 },
            rightHinge: { x: 0.902, y: 0.439 },
            hingeX: 0.402,
            hingeY: -0.061,
            templeWidthRatio: 0.050
        }),
        square: freezeFitProfile({
            ...DEFAULT_FRAME_FIT_PROFILE,
            profileKey: 'square',
            leftHinge: { x: 0.098, y: 0.439 },
            rightHinge: { x: 0.902, y: 0.439 },
            hingeX: 0.402,
            hingeY: -0.061,
            templeWidthRatio: 0.035
        })
    });
    const ROUND_METAL_FIT_PROFILE = FRAME_FIT_PROFILES.round;
    const TITAN_SLIM_FIT_PROFILE = FRAME_FIT_PROFILES.titan;

    const NORMALIZED_ELLIPSE_KAPPA = 0.5522847498307936;

    function createPolygonPath(points) {
        return points.map((point, index) => [index === 0 ? 'M' : 'L', point[0], point[1]])
            .concat([['Z']]);
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

    function reflectLensPath(path) {
        return path.map(command => {
            const reflected = [...command];
            for (let index = 1; index < reflected.length; index += 2) {
                reflected[index] = 1 - reflected[index];
            }
            return reflected;
        });
    }

    function freezeLensPath(path) {
        return Object.freeze(path.map(command => Object.freeze([...command])));
    }

    function createLensContourProfile(leftPath) {
        return Object.freeze({
            left: freezeLensPath(leftPath),
            right: freezeLensPath(reflectLensPath(leftPath))
        });
    }

    // Lens apertures are traced from each active 1024px overlay rather than inferred
    // from broad catalog shape names. The tint is painted beneath the front, so these
    // source-normalized paths meet the inner rim without leaking onto the face. Sports
    // Wrap is intentionally absent because its original smoke lens is baked into the
    // overlay and must never receive a selectable canvas tint.
    const FRAME_LENS_CONTOURS = Object.freeze({
        aviator: createLensContourProfile(createPolygonPath([
            [0.4160, 0.3877], [0.4414, 0.4277], [0.4404, 0.4785], [0.4111, 0.5498],
            [0.3604, 0.6123], [0.3213, 0.6406], [0.2646, 0.6611], [0.2100, 0.6553],
            [0.1602, 0.6221], [0.1289, 0.5684], [0.1133, 0.4941], [0.1211, 0.4346],
            [0.1494, 0.3945], [0.1973, 0.3711], [0.2773, 0.3594], [0.3613, 0.3652]
        ])),
        wayfarer: createLensContourProfile(createPolygonPath([
            [0.4229, 0.4385], [0.4336, 0.4678], [0.4248, 0.5342], [0.4043, 0.5830],
            [0.3760, 0.6172], [0.3438, 0.6387], [0.2949, 0.6484], [0.2246, 0.6455],
            [0.1709, 0.6260], [0.1445, 0.5752], [0.1299, 0.5117], [0.1309, 0.4531],
            [0.1523, 0.4170], [0.2041, 0.4004], [0.3047, 0.3984], [0.3838, 0.4141]
        ])),
        round: createLensContourProfile(createEllipsePath(
            0.279296875,
            0.509765625,
            0.169921875,
            0.1640625
        )),
        clubmaster: createLensContourProfile(createPolygonPath([
            [0.1523, 0.4141], [0.1973, 0.3926], [0.2666, 0.3857], [0.3477, 0.3945],
            [0.3945, 0.4150], [0.4229, 0.4434], [0.4316, 0.4775], [0.4209, 0.5430],
            [0.3965, 0.5908], [0.3691, 0.6191], [0.3066, 0.6406], [0.2471, 0.6387],
            [0.1904, 0.6172], [0.1572, 0.5801], [0.1328, 0.5156], [0.1299, 0.4775]
        ])),
        titan: createLensContourProfile([
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
        ]),
        cateye: createLensContourProfile(createPolygonPath([
            [0.1064, 0.3896], [0.1758, 0.3770], [0.2764, 0.3789], [0.3525, 0.3945],
            [0.4082, 0.4219], [0.4287, 0.4453], [0.4375, 0.4824], [0.4180, 0.5625],
            [0.4014, 0.5918], [0.3613, 0.6309], [0.3047, 0.6533], [0.2344, 0.6504],
            [0.1875, 0.6299], [0.1494, 0.5957], [0.1133, 0.5332], [0.0967, 0.4658],
            [0.0957, 0.4092]
        ])),
        geometric: createLensContourProfile(createPolygonPath([
            [0.3848, 0.3945], [0.4248, 0.4424], [0.4346, 0.4727], [0.4268, 0.5400],
            [0.3867, 0.6182], [0.3623, 0.6387], [0.3086, 0.6494], [0.2305, 0.6465],
            [0.1875, 0.6328], [0.1484, 0.5723], [0.1299, 0.5078], [0.1309, 0.4541],
            [0.1621, 0.4014], [0.1914, 0.3838], [0.2461, 0.3789], [0.3359, 0.3818]
        ])),
        oval: createLensContourProfile(createEllipsePath(0.2730, 0.4956, 0.1538, 0.1392)),
        square: createLensContourProfile(createPolygonPath([
            [0.4541, 0.4453], [0.4609, 0.4736], [0.4580, 0.4902], [0.4160, 0.6084],
            [0.3848, 0.6416], [0.3535, 0.6484], [0.1689, 0.6309], [0.1201, 0.4531],
            [0.1211, 0.4375], [0.1963, 0.4219], [0.3740, 0.4092], [0.4219, 0.4160],
            [0.4395, 0.4287]
        ]))
    });

    const FRAME_NAME_PROFILE_KEYS = Object.freeze([
        ['aviator', 'aviator'],
        ['wayfarer', 'wayfarer'],
        ['round', 'round'],
        ['clubmaster', 'clubmaster'],
        ['titan', 'titan'],
        ['cat eye', 'cateye'],
        ['cateye', 'cateye'],
        ['geometric', 'geometric'],
        ['oval', 'oval'],
        ['sport', 'sport'],
        ['square', 'square']
    ]);

    function getFileName(source) {
        return String(source || '')
            .split(/[?#]/, 1)[0]
            .replace(/\\/g, '/')
            .split('/')
            .pop()
            .toLowerCase();
    }

    function normalizeLabel(value) {
        return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    function getFrameProfileKey(frame) {
        const imageFile = getFileName(frame && frame.image_url);
        const sourceKey = imageFile
            .replace(/_(?:front|overlay)\.(?:png|svg)$/i, '')
            .replace(/\.(?:png|svg)$/i, '');
        if (FRAME_FIT_PROFILES[sourceKey]) return sourceKey;

        const name = normalizeLabel(frame && frame.name);
        const match = FRAME_NAME_PROFILE_KEYS.find(([token]) => name.includes(token));
        return match ? match[1] : null;
    }

    function cloneFitProfile(profile) {
        return {
            ...profile,
            leftHinge: { ...profile.leftHinge },
            rightHinge: { ...profile.rightHinge }
        };
    }

    function getFrameFitProfile(frame) {
        const profileKey = getFrameProfileKey(frame);
        return cloneFitProfile(FRAME_FIT_PROFILES[profileKey] || DEFAULT_FRAME_FIT_PROFILE);
    }

    function cloneLensPath(path) {
        return path.map(command => [...command]);
    }

    function getFrameLensContours(frame) {
        const profileKey = getFrameProfileKey(frame);
        const contours = FRAME_LENS_CONTOURS[profileKey];
        if (!contours) return null;

        return {
            profileKey,
            left: cloneLensPath(contours.left),
            right: cloneLensPath(contours.right)
        };
    }

    function resolveFrameColor(requestedColor, fallbackColor) {
        const requestedKey = normalizeLabel(requestedColor);
        const fallbackKey = normalizeLabel(fallbackColor);
        return FRAME_COLOR_HEX[requestedKey]
            || FRAME_COLOR_HEX[fallbackKey]
            || DEFAULT_FRAME_COLOR;
    }

    function resolveFrameRenderStyle(frame, requestedColor) {
        const frameColor = resolveFrameColor(requestedColor, frame && frame.color);
        return { frameColor, templeColor: frameColor };
    }

    function requiresCheckerboardCleanup(source) {
        return CHECKERBOARD_OVERLAY_FILES.has(getFileName(source));
    }

    function requiresSquareFrontProcessing(source) {
        return getFileName(source) === SQUARE_OVERLAY_FILE;
    }

    function requiresOvalFrontProcessing(source) {
        return getFileName(source) === OVAL_OVERLAY_FILE;
    }

    function requiresClubmasterFrontProcessing(source) {
        return getFileName(source) === CLUBMASTER_OVERLAY_FILE;
    }

    function requiresCateyeFrontProcessing(source) {
        return getFileName(source) === CATEYE_OVERLAY_FILE;
    }

    function requiresSportFrontProcessing(source) {
        return getFileName(source) === SPORT_OVERLAY_FILE;
    }

    function requiresPixelProcessing(source) {
        return requiresCheckerboardCleanup(source)
            || requiresSquareFrontProcessing(source)
            || requiresOvalFrontProcessing(source)
            || requiresClubmasterFrontProcessing(source)
            || requiresCateyeFrontProcessing(source)
            || requiresSportFrontProcessing(source);
    }

    function removeCheckerboardPixels(pixelData) {
        if (!pixelData || typeof pixelData.length !== 'number') {
            throw new TypeError('RGBA pixel data is required.');
        }

        let removedPixels = 0;

        for (let i = 0; i < pixelData.length; i += 4) {
            // Checker squares are fully opaque. Keeping every partially transparent
            // pixel is essential for translucent crystal and anti-aliased frame rims.
            if (pixelData[i + 3] < 250) continue;

            const red = pixelData[i];
            const green = pixelData[i + 1];
            const blue = pixelData[i + 2];
            const brightest = Math.max(red, green, blue);
            const darkest = Math.min(red, green, blue);
            const isNeutral = brightest - darkest <= 25;
            const isCheckerTone = brightest >= 205 || (brightest >= 50 && brightest <= 145);

            if (isNeutral && isCheckerTone) {
                pixelData[i + 3] = 0;
                removedPixels += 1;
            }
        }

        return removedPixels;
    }

    function isSquareSourceTemplePixel(x, y, width, height) {
        const normalizedY = (y + 0.5) / height;
        if (normalizedY < 0.565) return false;

        // The baked-in temples fan outward below the hinge. This sloped boundary
        // follows that fan while staying outside the front rim's lower corners.
        const progress = Math.min(1, Math.max(0, (normalizedY - 0.565) / 0.115));
        const outerBoundary = 0.142 + progress * 0.048;
        const normalizedX = (x + 0.5) / width;

        return normalizedX < outerBoundary || normalizedX > 1 - outerBoundary;
    }

    function isPointInPolygon(x, y, polygon) {
        let inside = false;

        for (let i = 0, previous = polygon.length - 1; i < polygon.length; previous = i, i += 1) {
            const currentX = polygon[i][0];
            const currentY = polygon[i][1];
            const previousX = polygon[previous][0];
            const previousY = polygon[previous][1];
            const crossesY = (currentY > y) !== (previousY > y);

            if (crossesY) {
                const edgeX = ((previousX - currentX) * (y - currentY))
                    / (previousY - currentY) + currentX;
                if (x < edgeX) inside = !inside;
            }
        }

        return inside;
    }

    function isOvalSourceTemplePixel(x, y, width, height) {
        const normalizedY = (y + 0.5) / height;
        if (normalizedY < 0.452 || normalizedY > 0.590) return false;

        const normalizedX = (x + 0.5) / width;
        const mirroredX = normalizedX > 0.5 ? 1 - normalizedX : normalizedX;
        return isPointInPolygon(mirroredX, normalizedY, OVAL_SOURCE_TEMPLE_POLYGON);
    }

    function isClubmasterSourceTemplePixel(x, y, width, height) {
        const normalizedY = (y + 0.5) / height;
        if (normalizedY < 0.425 || normalizedY > 0.597) return false;

        const normalizedX = (x + 0.5) / width;
        const mirroredX = normalizedX > 0.5 ? 1 - normalizedX : normalizedX;
        return isPointInPolygon(mirroredX, normalizedY, CLUBMASTER_SOURCE_TEMPLE_POLYGON);
    }

    function isCateyeSourceTemplePixel(x, y, width, height) {
        const normalizedY = (y + 0.5) / height;
        if (normalizedY < 0.414 || normalizedY > 0.575) return false;

        const normalizedX = (x + 0.5) / width;
        const mirroredX = normalizedX > 0.5 ? 1 - normalizedX : normalizedX;
        return isPointInPolygon(mirroredX, normalizedY, CATEYE_SOURCE_TEMPLE_POLYGON);
    }

    function isSportSourceTemplePixel(x, y, width, height) {
        const normalizedY = (y + 0.5) / height;
        if (normalizedY < 0.438 || normalizedY > 0.548) return false;

        const normalizedX = (x + 0.5) / width;
        const mirroredX = normalizedX > 0.5 ? 1 - normalizedX : normalizedX;
        return isPointInPolygon(mirroredX, normalizedY, SPORT_SOURCE_TEMPLE_POLYGON);
    }

    function getPolygonHorizontalBounds(y, polygon) {
        const intersections = [];

        for (let i = 0, previous = polygon.length - 1; i < polygon.length; previous = i, i += 1) {
            const currentX = polygon[i][0];
            const currentY = polygon[i][1];
            const previousX = polygon[previous][0];
            const previousY = polygon[previous][1];

            if ((currentY > y) !== (previousY > y)) {
                intersections.push(
                    currentX + ((y - currentY) * (previousX - currentX))
                    / (previousY - currentY)
                );
            }
        }

        if (intersections.length < 2) return null;
        return [Math.min(...intersections), Math.max(...intersections)];
    }

    function processSquareFront(pixelData, width, height) {
        if (!pixelData || typeof pixelData.length !== 'number') {
            throw new TypeError('RGBA pixel data is required.');
        }
        if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
            throw new RangeError('Positive integer overlay dimensions are required.');
        }
        if (pixelData.length !== width * height * 4) {
            throw new RangeError('Pixel data length does not match the overlay dimensions.');
        }

        let removedPixels = 0;
        let enhancedPixels = 0;

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const index = (y * width + x) * 4;
                const alpha = pixelData[index + 3];
                if (alpha === 0) continue;

                if (isSquareSourceTemplePixel(x, y, width, height)) {
                    pixelData[index + 3] = 0;
                    removedPixels += 1;
                    continue;
                }

                // Pull the crystal material toward its bright catalog highlights.
                // Two layers of the source alpha mimic the stronger reflections in
                // the product photo, while the cap keeps every pixel translucent.
                for (let channel = 0; channel < 3; channel += 1) {
                    const value = pixelData[index + channel];
                    pixelData[index + channel] = Math.min(
                        255,
                        Math.round(value + (255 - value) * SQUARE_COLOR_LIFT)
                    );
                }

                const transparency = 1 - alpha / 255;
                const layeredAlpha = 255 * (1 - Math.pow(transparency, SQUARE_ALPHA_LAYERS));
                pixelData[index + 3] = Math.min(SQUARE_MAX_ALPHA, Math.round(layeredAlpha));
                enhancedPixels += 1;
            }
        }

        return { removedPixels, enhancedPixels };
    }

    function processOvalFront(pixelData, width, height) {
        if (!pixelData || typeof pixelData.length !== 'number') {
            throw new TypeError('RGBA pixel data is required.');
        }
        if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
            throw new RangeError('Positive integer overlay dimensions are required.');
        }
        if (pixelData.length !== width * height * 4) {
            throw new RangeError('Pixel data length does not match the overlay dimensions.');
        }

        let removedPixels = 0;

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const index = (y * width + x) * 4;
                if (pixelData[index + 3] === 0 || !isOvalSourceTemplePixel(x, y, width, height)) {
                    continue;
                }

                pixelData[index + 3] = 0;
                removedPixels += 1;
            }
        }

        return { removedPixels, enhancedPixels: 0 };
    }

    function processClubmasterFront(pixelData, width, height) {
        if (!pixelData || typeof pixelData.length !== 'number') {
            throw new TypeError('RGBA pixel data is required.');
        }
        if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
            throw new RangeError('Positive integer overlay dimensions are required.');
        }
        if (pixelData.length !== width * height * 4) {
            throw new RangeError('Pixel data length does not match the overlay dimensions.');
        }

        let removedPixels = 0;

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const index = (y * width + x) * 4;
                if (pixelData[index + 3] === 0 || !isClubmasterSourceTemplePixel(x, y, width, height)) {
                    continue;
                }

                pixelData[index + 3] = 0;
                removedPixels += 1;
            }
        }

        return { removedPixels, enhancedPixels: 0 };
    }

    function processCateyeFront(pixelData, width, height) {
        if (!pixelData || typeof pixelData.length !== 'number') {
            throw new TypeError('RGBA pixel data is required.');
        }
        if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
            throw new RangeError('Positive integer overlay dimensions are required.');
        }
        if (pixelData.length !== width * height * 4) {
            throw new RangeError('Pixel data length does not match the overlay dimensions.');
        }

        let removedPixels = 0;

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const index = (y * width + x) * 4;
                if (pixelData[index + 3] === 0 || !isCateyeSourceTemplePixel(x, y, width, height)) {
                    continue;
                }

                pixelData[index + 3] = 0;
                removedPixels += 1;
            }
        }

        return { removedPixels, enhancedPixels: 0 };
    }

    function processSportFront(pixelData, width, height) {
        if (!pixelData || typeof pixelData.length !== 'number') {
            throw new TypeError('RGBA pixel data is required.');
        }
        if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
            throw new RangeError('Positive integer overlay dimensions are required.');
        }
        if (pixelData.length !== width * height * 4) {
            throw new RangeError('Pixel data length does not match the overlay dimensions.');
        }

        // The Sports Wrap lenses are themselves tinted pixels, so clearing the copied
        // temples would leave holes. Reconstruct each affected row from clean lens
        // pixels immediately beside the temple while preserving the original smoke tint.
        const originalPixels = new Uint8ClampedArray(pixelData);
        const samplePadding = Math.max(1, Math.round(width * 0.007));
        let removedPixels = 0;

        const reconstructRegion = (y, start, end) => {
            const sampleLeft = Math.max(0, start - samplePadding);
            const sampleRight = Math.min(width - 1, end + samplePadding);
            const span = Math.max(1, sampleRight - sampleLeft);

            for (let x = start; x <= end; x += 1) {
                const ratio = (x - sampleLeft) / span;
                const index = (y * width + x) * 4;
                const leftIndex = (y * width + sampleLeft) * 4;
                const rightIndex = (y * width + sampleRight) * 4;
                let changed = false;

                for (let channel = 0; channel < 4; channel += 1) {
                    const value = Math.round(
                        originalPixels[leftIndex + channel]
                        + (originalPixels[rightIndex + channel] - originalPixels[leftIndex + channel]) * ratio
                    );
                    if (pixelData[index + channel] !== value) changed = true;
                    pixelData[index + channel] = value;
                }

                if (changed) removedPixels += 1;
            }
        };

        for (let y = 0; y < height; y += 1) {
            const normalizedY = (y + 0.5) / height;
            if (normalizedY < 0.438 || normalizedY > 0.548) continue;

            const bounds = getPolygonHorizontalBounds(normalizedY, SPORT_SOURCE_TEMPLE_POLYGON);
            if (!bounds) continue;

            const leftStart = Math.max(0, Math.floor(bounds[0] * width));
            const leftEnd = Math.min(width - 1, Math.ceil(bounds[1] * width));
            reconstructRegion(y, leftStart, leftEnd);

            const rightStart = width - 1 - leftEnd;
            const rightEnd = width - 1 - leftStart;
            reconstructRegion(y, rightStart, rightEnd);
        }

        return { removedPixels, enhancedPixels: 0 };
    }

    function processOverlayPixels(source, pixelData, width, height) {
        if (requiresSquareFrontProcessing(source)) {
            return processSquareFront(pixelData, width, height);
        }

        if (requiresOvalFrontProcessing(source)) {
            return processOvalFront(pixelData, width, height);
        }

        if (requiresClubmasterFrontProcessing(source)) {
            return processClubmasterFront(pixelData, width, height);
        }

        if (requiresCateyeFrontProcessing(source)) {
            return processCateyeFront(pixelData, width, height);
        }

        if (requiresSportFrontProcessing(source)) {
            return processSportFront(pixelData, width, height);
        }

        if (requiresCheckerboardCleanup(source)) {
            return { removedPixels: removeCheckerboardPixels(pixelData), enhancedPixels: 0 };
        }

        return { removedPixels: 0, enhancedPixels: 0 };
    }

    return {
        CHECKERBOARD_OVERLAY_FILES,
        SQUARE_OVERLAY_FILE,
        SQUARE_COLOR_LIFT,
        SQUARE_ALPHA_LAYERS,
        SQUARE_MAX_ALPHA,
        OVAL_OVERLAY_FILE,
        OVAL_SOURCE_TEMPLE_POLYGON,
        CLUBMASTER_OVERLAY_FILE,
        CLUBMASTER_SOURCE_TEMPLE_POLYGON,
        CATEYE_OVERLAY_FILE,
        CATEYE_SOURCE_TEMPLE_POLYGON,
        SPORT_OVERLAY_FILE,
        SPORT_SOURCE_TEMPLE_POLYGON,
        FRAME_COLOR_HEX,
        DEFAULT_FRAME_COLOR,
        DEFAULT_FRAME_FIT_PROFILE,
        FRAME_FIT_PROFILES,
        FRAME_LENS_CONTOURS,
        ROUND_METAL_FIT_PROFILE,
        TITAN_SLIM_FIT_PROFILE,
        getFileName,
        getFrameProfileKey,
        getFrameFitProfile,
        getFrameLensContours,
        resolveFrameColor,
        resolveFrameRenderStyle,
        requiresCheckerboardCleanup,
        requiresSquareFrontProcessing,
        requiresOvalFrontProcessing,
        requiresClubmasterFrontProcessing,
        requiresCateyeFrontProcessing,
        requiresSportFrontProcessing,
        requiresPixelProcessing,
        removeCheckerboardPixels,
        isSquareSourceTemplePixel,
        isOvalSourceTemplePixel,
        isClubmasterSourceTemplePixel,
        isCateyeSourceTemplePixel,
        isSportSourceTemplePixel,
        processSquareFront,
        processOvalFront,
        processClubmasterFront,
        processCateyeFront,
        processSportFront,
        processOverlayPixels
    };
}));
