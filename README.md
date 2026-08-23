# Virtual Try-On Eyewear Store

A Node.js, Express, SQLite, EJS, and Vue application for browsing eyewear, trying frames on with MediaPipe face landmarks, and receiving Gemini-powered styling guidance.

## AI styling features

- Face-shape frame recommendations: MediaPipe estimates one of six supported face shapes in the browser. The server maps that shape to suitable frame silhouettes, retrieves matching catalog frames, and asks Gemini to explain the visual balance.
- Personalized style suggestions: Gemini explains why the currently selected frame shape, frame color, and lens treatment work together, optionally using the detected face shape.
- Resilient fallbacks: both features return curated local guidance if the Gemini key is missing, the request times out, quota is exhausted, or the model returns incomplete text.
- Privacy-minded flow: portrait pixels stay in the browser for face-shape analysis. Only the detected shape, bounded landmark ratios, and selected product attributes are sent to the server-side Gemini integration.

Styling guidance is subjective and should not be treated as a medical or biometric assessment.

## Setup

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm --prefix client install
copy env.example .env
```

Add a Gemini API key to `.env`:

```dotenv
GEMINI_API_KEY=your_key_from_google_ai_studio
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=12000
```

Then build the Vue islands and start Express:

```bash
npm run build
npm start
```

Open `http://localhost:3000`. SQLite tables and starter frame records are created automatically on first start.

## Relevant endpoints

### Recommend frames for a detected face shape

`POST /customer/ai-recommend`

```json
{
  "faceShape": "Round",
  "metrics": {
    "ratio": 1.05,
    "jawRatio": 0.83,
    "foreheadRatio": 0.88,
    "lowerJawRatio": 0.68
  }
}
```

The response includes `recommendedShapes`, matching `frames`, an `explanation`, and a `source` value of `gemini` or `fallback`.

### Explain a selected style

`POST /customer/ai-style-suggestion`

```json
{
  "frameId": 3,
  "color": "Tortoise",
  "lensStyle": "Brown Tint",
  "faceShape": "Square"
}
```

The response includes a concise `suggestion` covering frame shape, color, and lens style, plus its `source`.

Both routes are mounted under the authenticated customer router.

## Project structure

```text
client/src/components/AiRecommendations/  Face analysis and recommendation UI
client/src/components/VirtualTryOn/       Try-on and selected-style explanation UI
controllers/customerController.js         HTTP handlers and catalog lookup
utils/geminiStylistService.js              Gemini prompts, validation, and fallbacks
test/geminiStylistService.test.js          Unit tests with mocked Gemini responses
```

## Test

```bash
npm test
npm run build
```

Tests never call the live Gemini API.
