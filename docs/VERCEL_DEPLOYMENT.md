# Vercel deployment

This project can be imported directly from the `master` branch. Vercel runs the exported Express application as a Function and serves files under `public/` from its CDN. The configured build command compiles the Vue components and copies Bootstrap's distributable files into `public/vendor/bootstrap`.

## 1. Create the production database

Create a Turso database and database token, or install Turso from the Vercel Marketplace. Add both values to the Vercel project:

```dotenv
TURSO_DATABASE_URL=libsql://your-database-name-your-org.turso.io
TURSO_AUTH_TOKEN=your_database_token
```

The schema, migrations, starter frames, and initial admin account are created automatically on the first request. Local development continues to use `DB_PATH=./database.sqlite` when `TURSO_DATABASE_URL` is absent.

Do not deploy without Turso. SQLite files written inside a Vercel Function are temporary and are not shared between Function instances; the application deliberately fails fast on Vercel if `TURSO_DATABASE_URL` is missing.

## 2. Configure Vercel environment variables

In **Project Settings > Environment Variables**, configure these for Production and for any Preview environment that needs full functionality:

Required application and storage values:

```dotenv
JWT_SECRET=use_a_long_random_value
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
BASE_URL=https://your-production-domain.example
```

Feature-specific values:

```dotenv
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=12000

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

SSLCOMMERZ_STORE_ID=...
SSLCOMMERZ_STORE_PASSWORD=...
SSLCOMMERZ_IS_SANDBOX=true

MAPTILER_API_KEY=...
```

`BASE_URL` should be the stable production URL, including `https://`, so payment callbacks and email links do not point at a temporary Preview URL. The application can fall back to Vercel's system URL for ordinary links, but payment providers should use the stable domain.

Never add `.env` or database tokens to Git. The repository only contains `env.example` placeholders.

## 3. Import and deploy

1. In Vercel, choose **Add New > Project** and import `adg1205/virtual_try_on`.
2. Select `master` as the production branch and leave the root directory at the repository root.
3. Keep the install command at the npm default. The root `package-lock.json` installs the server packages, and npm also installs the Vue client packages through the root package's install lifecycle.
4. The build command is already set to `npm run build` in `vercel.json`.
5. Add the environment variables above and deploy.

Vercel currently supports Node.js 22, which is pinned in `package.json` for repeatable builds.

## 4. Verify the deployment

After the first request completes, check the following:

- The home page, login page, Bootstrap styling, and Vue try-on interface load without 404 errors.
- A new account persists after a fresh deployment.
- Profile-photo upload and saved try-on history return Cloudinary URLs.
- Wishlist, cart, order placement, and order tracking persist in Turso.
- Gemini recommendations work when the key is configured.
- Payment success/cancel/IPN callback URLs use the production domain.
- Email links use the production domain.

Use a separate Turso database or separately scoped data for Preview deployments if Preview changes must not touch production records.

## Platform constraints handled by the application

- Persistent data uses Turso rather than a local SQLite file.
- Uploaded images use Cloudinary memory uploads rather than `public/uploads` writes.
- Express is exported without starting a listener on Vercel.
- Database initialization is awaited before requests are handled.
- JSON and image sizes are capped below Vercel's 4.5 MB request/response limit.
- Bootstrap is copied to `public/` because Express static middleware is not used to serve public assets on Vercel.
