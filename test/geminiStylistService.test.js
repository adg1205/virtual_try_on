const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeFaceShape,
    normalizeMetrics,
    getRecommendedFrameShapes,
    createFrameRecommendation,
    createStyleSuggestion
} = require('../utils/geminiStylistService');

function withGeminiEnvironment(apiKey, callback) {
    const originalApiKey = process.env.GEMINI_API_KEY;
    const originalModel = process.env.GEMINI_MODEL;
    process.env.GEMINI_API_KEY = apiKey;
    process.env.GEMINI_MODEL = 'gemini-test-model';

    return Promise.resolve()
        .then(callback)
        .finally(() => {
            if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
            else process.env.GEMINI_API_KEY = originalApiKey;

            if (originalModel === undefined) delete process.env.GEMINI_MODEL;
            else process.env.GEMINI_MODEL = originalModel;
        });
}

test('normalizes supported face shapes and rejects unknown values', () => {
    assert.equal(normalizeFaceShape(' round '), 'Round');
    assert.equal(normalizeFaceShape('SQUARE'), 'Square');
    assert.equal(normalizeFaceShape('triangle'), undefined);
    assert.deepEqual(
        getRecommendedFrameShapes('Round').slice(0, 2),
        ['Rectangular', 'Square']
    );
});

test('keeps only finite, plausible landmark metrics', () => {
    assert.deepEqual(normalizeMetrics({
        ratio: '1.234',
        jawRatio: 0.82,
        foreheadRatio: 99,
        lowerJawRatio: 'not-a-number',
        injected: 1
    }), {
        ratio: 1.23,
        jawRatio: 0.82
    });
});

test('returns deterministic recommendations when Gemini is not configured', async () => {
    await withGeminiEnvironment('', async () => {
        const result = await createFrameRecommendation({ faceShape: 'Round' });

        assert.equal(result.source, 'fallback');
        assert.deepEqual(result.recommendedShapes.slice(0, 2), ['Rectangular', 'Square']);
        assert.match(result.explanation, /Rectangular and square frames/i);
    });
});

test('calls Gemini without putting the API key in the URL', async () => {
    await withGeminiEnvironment('test-secret-key', async () => {
        const fetchImpl = async (url, options) => {
            assert.match(url, /gemini-test-model:generateContent$/);
            assert.doesNotMatch(url, /test-secret-key/);
            assert.equal(options.headers['x-goog-api-key'], 'test-secret-key');

            const body = JSON.parse(options.body);
            assert.match(body.contents[0].parts[0].text, /Round/);
            assert.match(body.contents[0].parts[0].text, /Rectangular/);

            return {
                ok: true,
                json: async () => ({
                    candidates: [{
                        content: {
                            parts: [{ text: 'Your round face has soft curves. Rectangular frames add definition. Square frames create angular contrast. Choose a comfortably wide fit.' }]
                        }
                    }]
                })
            };
        };

        const result = await createFrameRecommendation({
            faceShape: 'round',
            metrics: { ratio: 1.05 },
            fetchImpl
        });

        assert.equal(result.source, 'gemini');
        assert.match(result.explanation, /Square frames/);
    });
});

test('rejects unsupported face-shape input before querying Gemini', async () => {
    await assert.rejects(
        createFrameRecommendation({ faceShape: 'Triangle' }),
        error => error.code === 'INVALID_FACE_SHAPE'
    );
});

test('generates a style suggestion for frame, color, and lens selections', async () => {
    await withGeminiEnvironment('test-secret-key', async () => {
        const frame = {
            name: 'Metro Round',
            brand: 'Example',
            shape: 'Round',
            color: 'Black',
            material: 'Acetate'
        };
        const fetchImpl = async (_url, options) => {
            const prompt = JSON.parse(options.body).contents[0].parts[0].text;
            assert.match(prompt, /Selected color: Tortoise/);
            assert.match(prompt, /Selected lens style: Brown Tint/);
            assert.match(prompt, /Detected face shape: Square/);

            return {
                ok: true,
                json: async () => ({
                    candidates: [{
                        content: {
                            parts: [{ text: 'The round frame softens your square features, while the tortoise finish adds warmth. Brown-tint lenses complete the palette and improve outdoor versatility.' }]
                        }
                    }]
                })
            };
        };

        const result = await createStyleSuggestion({
            frame,
            color: 'Tortoise',
            lensStyle: 'Brown Tint',
            faceShape: 'Square',
            fetchImpl
        });

        assert.equal(result.source, 'gemini');
        assert.match(result.suggestion, /tortoise/i);
    });
});

test('uses complete local style copy if Gemini returns a truncated sentence', async () => {
    await withGeminiEnvironment('test-secret-key', async () => {
        const result = await createStyleSuggestion({
            frame: { shape: 'Rectangular', color: 'Black' },
            lensStyle: 'Clear Lens',
            faceShape: 'Round',
            fetchImpl: async () => ({
                ok: true,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: 'This frame would look' }] } }]
                })
            })
        });

        assert.equal(result.source, 'fallback');
        assert.match(result.suggestion, /Clear lenses/);
    });
});
