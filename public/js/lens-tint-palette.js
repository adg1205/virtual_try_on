(function (root, factory) {
    const palette = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = palette;
    }

    if (root) {
        root.LensTintPalette = palette;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Source-over canvas colors tuned to resemble common optical lens appearances:
    // blue-light lenses remain nearly clear, gray is neutral, brown is warm, and the
    // sunglass preset is a substantially darker neutral smoke.
    const LENS_TINT_OPTIONS = Object.freeze([
        Object.freeze({
            id: 'clear',
            label: 'Clear Lens',
            canvasColor: 'rgba(0, 0, 0, 0)',
            swatchColor: 'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.04))',
            previewLabel: ''
        }),
        Object.freeze({
            id: 'blue-light',
            label: 'Blue-Light Lens',
            canvasColor: 'rgba(135, 196, 222, 0.09)',
            swatchColor: 'rgba(135, 196, 222, 0.55)',
            previewLabel: 'Subtle Blue-Light Filter'
        }),
        Object.freeze({
            id: 'gray',
            label: 'Gray Tint',
            canvasColor: 'rgba(65, 69, 74, 0.38)',
            swatchColor: 'rgba(65, 69, 74, 0.88)',
            previewLabel: 'Neutral Gray Tint'
        }),
        Object.freeze({
            id: 'brown',
            label: 'Brown Tint',
            canvasColor: 'rgba(109, 74, 43, 0.40)',
            swatchColor: 'rgba(109, 74, 43, 0.90)',
            previewLabel: 'Warm Brown Tint'
        }),
        Object.freeze({
            id: 'sunglass',
            label: 'Sunglass Tint',
            canvasColor: 'rgba(18, 22, 26, 0.72)',
            swatchColor: 'rgba(18, 22, 26, 0.98)',
            previewLabel: 'Deep Smoke Sunglass Tint'
        })
    ]);

    const TINTS_BY_ID = Object.freeze(Object.fromEntries(
        LENS_TINT_OPTIONS.map(option => [option.id, option])
    ));

    function normalizeLensName(value) {
        return String(value || '')
            .trim()
            .replace(/[????]/g, '-')
            .replace(/\s+/g, ' ')
            .toLowerCase();
    }

    const TINT_ID_BY_NAME = Object.freeze({
        'clear': 'clear',
        'clear lens': 'clear',
        'clear / prescription': 'clear',
        'prescription': 'clear',
        'blue-light': 'blue-light',
        'blue light': 'blue-light',
        'blue-light lens': 'blue-light',
        'blue light lens': 'blue-light',
        'blue light blocking': 'blue-light',
        'blue-light blocking': 'blue-light',
        'gray': 'gray',
        'grey': 'gray',
        'gray tint': 'gray',
        'grey tint': 'gray',
        'brown': 'brown',
        'brown tint': 'brown',
        'sunglass': 'sunglass',
        'sunglasses': 'sunglass',
        'sunglass tint': 'sunglass',
        'sunglasses / tinted': 'sunglass',

        // Retired selections are accepted only for saved-look/query compatibility.
        // They always resolve into one of the five public choices above.
        'transition / photochromic': 'gray',
        'photochromic': 'gray',
        'transition': 'gray',
        'polarized': 'sunglass',
        'mirror coated': 'sunglass',
        'mirror': 'sunglass'
    });

    function resolveLensTint(value) {
        const id = TINT_ID_BY_NAME[normalizeLensName(value)] || 'clear';
        return TINTS_BY_ID[id];
    }

    function isFixedSportLensFrame(frame) {
        const name = normalizeLensName(frame && (frame.name || frame.frame_name));
        const imageFile = String(frame && (frame.image_url || frame.frame_catalog_image) || '')
            .split(/[?#]/, 1)[0]
            .replace(/\\/g, '/')
            .split('/')
            .pop()
            .toLowerCase();
        return /sports? wrap/.test(name)
            || /^sport(?:_(?:front|overlay))?\.(?:png|svg)$/.test(imageFile);
    }

    function resolveLensTintForFrame(frame, value) {
        return isFixedSportLensFrame(frame)
            ? TINTS_BY_ID.sunglass
            : resolveLensTint(value);
    }

    function normalizeLensTintLabel(value) {
        return resolveLensTint(value).label;
    }

    function normalizeLensTintLabelForFrame(frame, value) {
        return resolveLensTintForFrame(frame, value).label;
    }

    return {
        LENS_TINT_OPTIONS,
        resolveLensTint,
        resolveLensTintForFrame,
        normalizeLensTintLabel,
        normalizeLensTintLabelForFrame,
        isFixedSportLensFrame
    };
}));
