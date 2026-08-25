const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const palette = require('../public/js/lens-tint-palette');

const componentPath = path.join(__dirname, '..', 'client', 'src', 'components', 'VirtualTryOn', 'VirtualTryOn.vue');
const componentSource = fs.readFileSync(componentPath, 'utf8');

const swatchesSource = fs.readFileSync(
    path.join(__dirname, '..', 'client', 'src', 'components', 'FrameDetails', 'LensTintSwatches.vue'),
    'utf8'
);

// The try-on workspace is a single-file component, so lift the plain data and
// helpers out of its <script> block rather than restating them here.
function extract(source, pattern, label) {
    const match = source.match(pattern);
    assert.ok(match, `expected to find ${label}`);
    return match[0];
}

function loadTints(source, declaration) {
    const block = extract(source, new RegExp(`const ${declaration} = \\[[\\s\\S]*?\\n\\];`), declaration);
    return new Function(`${block}; return ${declaration};`)();
}

function loadUploadValidator() {
    const parts = [
        extract(componentSource, /const ACCEPTED_UPLOAD_TYPES = \[[^\]]*\];/, 'ACCEPTED_UPLOAD_TYPES'),
        extract(componentSource, /const MAX_UPLOAD_BYTES = [^;]+;/, 'MAX_UPLOAD_BYTES'),
        extract(componentSource, /function describeFileSize\([\s\S]*?\n}/, 'describeFileSize'),
        extract(componentSource, /function validateUploadedImage\([\s\S]*?\n}/, 'validateUploadedImage')
    ];
    return new Function(`${parts.join('\n')}; return { validateUploadedImage, MAX_UPLOAD_BYTES };`)();
}

test('the try-on lens tints are the ones the catalogue understands', () => {
    const tints = loadTints(componentSource, 'availableTints');
    const canonical = palette.LENS_TINT_OPTIONS;

    assert.deepEqual(
        tints.map(t => t.id),
        canonical.map(t => t.id),
        'try-on tint ids should match public/js/lens-tint-palette.js'
    );
    assert.deepEqual(
        tints.map(t => t.name),
        canonical.map(t => t.label),
        'try-on tint labels should match the shared palette'
    );

    // The five the brief calls for, by name.
    ['Clear Lens', 'Blue-Light Lens', 'Gray Tint', 'Brown Tint', 'Sunglass Tint'].forEach(label => {
        assert.ok(tints.some(t => t.name === label), `missing lens option: ${label}`);
    });

    // The canvas overlay colour must match what the palette documents, so the
    // preview and the stored option describe the same lens.
    tints.forEach(tint => {
        const canonicalTint = canonical.find(c => c.id === tint.id);
        const expected = canonicalTint.canvasColor === 'rgba(0, 0, 0, 0)' ? 'transparent' : canonicalTint.canvasColor;
        assert.equal(tint.tintHex.replace(/\s/g, ''), expected.replace(/\s/g, ''), `overlay colour for ${tint.name}`);
    });
});

test('a previewed tint survives the trip to the server', () => {
    const tints = loadTints(componentSource, 'availableTints');
    const frame = { name: 'Aviator Classic', shape: 'Aviator' };

    // setTint sends activeTintName (the tint's `name`) as the lens option on
    // saved try-ons and style suggestions. An unrecognised label silently
    // resolves to "Clear Lens", which is how a locally invented palette threw
    // the customer's choice away.
    tints.forEach(tint => {
        assert.equal(
            palette.normalizeLensTintLabelForFrame(frame, tint.name),
            tint.name,
            `${tint.name} should round-trip unchanged`
        );
    });

    const nonClear = tints.filter(t => t.id !== 'clear');
    assert.ok(nonClear.length >= 4, 'four tinted options besides clear');
    nonClear.forEach(tint => {
        assert.notEqual(
            palette.normalizeLensTintLabelForFrame(frame, tint.name),
            'Clear Lens',
            `${tint.name} must not collapse to Clear Lens`
        );
    });

    // The frame details swatches and the try-on workspace must offer the same
    // lenses, or the same frame appears to have different options per page.
    const detailTints = loadTints(swatchesSource, 'tints');
    assert.deepEqual(detailTints.map(t => t.id), tints.map(t => t.id));
    assert.deepEqual(detailTints.map(t => t.name), tints.map(t => t.name));
});

test('uploaded photos are checked for type and size', () => {
    const { validateUploadedImage, MAX_UPLOAD_BYTES } = loadUploadValidator();
    const file = (name, type, size) => ({ name, type, size });

    // Accepted.
    assert.equal(validateUploadedImage(file('face.jpg', 'image/jpeg', 900 * 1024)), null);
    assert.equal(validateUploadedImage(file('face.png', 'image/png', 2 * 1024 * 1024)), null);
    assert.equal(validateUploadedImage(file('face.webp', 'image/webp', 512)), null);
    assert.equal(validateUploadedImage(file('exact.jpg', 'image/jpeg', MAX_UPLOAD_BYTES)), null, 'the limit itself is allowed');

    // Wrong type — accept="image/*" is only a picker hint, so this must be
    // caught in code.
    assert.match(validateUploadedImage(file('notes.txt', 'text/plain', 10)), /not an image/i);
    assert.match(validateUploadedImage(file('clip.mp4', 'video/mp4', 10)), /not an image/i);
    assert.match(validateUploadedImage(file('scan.pdf', 'application/pdf', 10)), /not an image/i);
    assert.match(validateUploadedImage(file('renamed.jpg', '', 10)), /not an image/i, 'an empty type is not a pass');

    // An image the workspace cannot use.
    assert.match(validateUploadedImage(file('art.tiff', 'image/tiff', 10)), /not supported/i);

    // Too large, and empty.
    const tooBig = validateUploadedImage(file('huge.jpg', 'image/jpeg', MAX_UPLOAD_BYTES + 1));
    assert.match(tooBig, /under/i);
    assert.match(tooBig, /MB/, 'the message should state the size in human terms');
    assert.match(validateUploadedImage(file('empty.jpg', 'image/jpeg', 0)), /empty/i);

    // The limit must stay under the server's JSON body cap, since the captured
    // image is posted back as base64 (roughly 4/3 the byte size) on save.
    const bodyLimitBytes = 4 * 1024 * 1024;
    assert.ok(MAX_UPLOAD_BYTES * 1.37 < bodyLimitBytes, 'base64 of a max-size upload must fit the Vercel-safe 4mb body limit');

    // And the file input should not advertise types the validator rejects.
    assert.match(componentSource, /accept="image\/jpeg,image\/png,image\/webp"/);
});

test('face landmarks drive the frame placement', () => {
    // MediaPipe FaceMesh indices the overlay maths depends on: outer eye
    // corners, nose bridge, and the temple points that bound the face.
    [33, 263, 168, 234, 454].forEach(index => {
        assert.match(componentSource, new RegExp(`landmarks\\[${index}\\]`), `landmark ${index} should be read`);
    });

    // Position, width, and angle are all derived rather than assumed.
    assert.match(componentSource, /const eyeDistance = Math\.hypot/, 'frame width comes from the eye separation');
    assert.match(componentSource, /const angle = Math\.atan2/, 'frame tilt comes from the eye axis');
    assert.match(componentSource, /ctx\.rotate\(angle\)/, 'the frame is rotated onto the eye axis');
    assert.match(componentSource, /const frameWidth = Math\.min\(/, 'frame width is clamped against the face width');

    // The live mirror tracks landmarks per frame and paints to a canvas.
    assert.match(componentSource, /detectForVideo\(/, 'live mode runs per-frame detection');
    assert.match(componentSource, /requestAnimationFrame\(renderLiveLoop\)/, 'the mirror runs on an animation frame loop');
    assert.match(componentSource, /smoothFaceLandmarks\(/, 'landmarks are smoothed so the overlay does not jitter');
});
