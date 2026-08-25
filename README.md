# Virtual Try-On Eyewear Store

A Node.js, Express, SQLite, EJS, and Vue application for browsing eyewear, trying frames on with MediaPipe face landmarks, and receiving Gemini-powered styling guidance.

## AI styling features

- Face-shape frame recommendations: MediaPipe estimates one of six supported face shapes in the browser. The server maps that shape to suitable frame silhouettes, retrieves matching catalog frames, and asks Gemini to explain the visual balance.
- Personalized style suggestions: Gemini explains why the currently selected frame shape, frame color, and lens treatment work together, optionally using the detected face shape.
- Resilient fallbacks: both features return curated local guidance if the Gemini key is missing, the request times out, quota is exhausted, or the model returns incomplete text.
- Privacy-minded flow: portrait pixels stay in the browser for face-shape analysis. Only the detected shape, bounded landmark ratios, and selected product attributes are sent to the server-side Gemini integration.

Styling guidance is subjective and should not be treated as a medical or biometric assessment.

## Cart, ordering, and popularity features

- Frame details store the selected frame ID, canonical lens option, quantity, database-sourced price, and color variant in the customer's cart.
- Cart quantities can be updated from 1–10 and items can be removed. The server calculates every line subtotal, cart subtotal, delivery charge, free-delivery progress, and total payable amount.
- Checkout validates delivery address, contact number, optional order note, and payment method. Cash-on-delivery orders, line-item snapshots, and cart clearing are committed in one SQLite transaction; verified Stripe and SSLCommerz callbacks also create persistent order and payment records.
- Stripe test-mode and SSLCommerz sandbox callbacks are verified for paid status, BDT currency, and the exact server-calculated cart total. Order rows, item snapshots, transaction ID, gateway, amount, status, paid time, and cart clearing are committed atomically; duplicate browser/IPN callbacks are idempotent.
- Successful COD placement and verified online payment both trigger a Nodemailer confirmation containing the order items, totals, payment method/status, gateway, transaction ID, amount, payment time, and tracking link.
- The trending page calculates most tried frames, most wishlisted frames, trending shapes, and frequently compared pairs from real activity tables. Shape activity combines try-ons, active wishlists, carts, placed-order quantities, and both frames in each comparison.

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

For confirmation email and sandbox checkout, configure the matching values from `env.example`:

```dotenv
BASE_URL=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
STRIPE_SECRET_KEY=sk_test_your_key
SSLCOMMERZ_STORE_ID=testbox
SSLCOMMERZ_STORE_PASSWORD=qwerty
SSLCOMMERZ_IS_SANDBOX=true
```

`BASE_URL` must be publicly reachable for SSLCommerz browser callbacks and IPN delivery when the app is not running only on localhost.

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

### Read cart totals

`GET /customer/api/cart` returns the stored cart rows and a server-calculated `summary` containing item subtotals, subtotal, delivery charge, total payable amount, and item count.

### Read popularity indicators

`GET /customer/api/trending?days=30&limit=5` returns the four activity-backed leaderboards. `days` is bounded to 1–365 and `limit` to 1–20.

## Project structure

```text
client/src/components/AiRecommendations/  Face analysis and recommendation UI
client/src/components/VirtualTryOn/       Try-on and selected-style explanation UI
controllers/customerController.js         HTTP handlers and catalog lookup
utils/geminiStylistService.js              Gemini prompts, validation, and fallbacks
utils/cartService.js                       Cart validation, totals, and checkout normalization
utils/paymentService.js                    Stripe/SSLCommerz verification and normalized payment records
test/geminiStylistService.test.js          Unit tests with mocked Gemini responses
test/cartService.test.js                   Pricing and checkout unit tests
test/commerceDatabase.test.js              Isolated SQLite cart/order/activity integration test
test/paymentService.test.js                Gateway response validation tests
test/paymentDatabase.test.js               Atomic paid-order and transaction persistence test
test/orderConfirmationEmail.test.js        Captured Nodemailer confirmation content test
```

## Test

```bash
npm test
npm run build
```

Tests never call the live Gemini API, payment gateways, or SMTP server.
