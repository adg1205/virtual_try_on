require('dotenv').config({ quiet: true });
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./models/Database');
const indexRoutes = require('./routes/indexRoutes');
const { checkUser } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;
const databaseReady = db.initializeDatabase();

app.set('trust proxy', 1);

// Set View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
// Serve the pinned Bootstrap distribution locally so the interface remains usable
// without relying on a third-party CDN at runtime.
app.use('/vendor/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true, limit: '4mb' }));
app.use(bodyParser.json({ limit: '4mb' }));
app.use(cookieParser());

// Disable caching for all routes and enable CORS for static canvas processing
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// Every serverless instance waits for idempotent schema initialization before
// serving database-backed routes.
app.use(async (_req, res, next) => {
    try {
        await databaseReady;
        next();
    } catch (error) {
        console.error('Database initialization failed:', error);
        res.status(503).send('The application database is temporarily unavailable.');
    }
});

// Check user global middleware
app.use(checkUser);

// Routes
app.use('/', indexRoutes);

app.use((error, _req, res, _next) => {
    console.error('Unhandled request error:', error);
    if (!res.headersSent) res.status(500).send('Internal Server Error');
});

// Vercel imports the Express application. Local development still starts a
// conventional listener when this file is executed directly.
if (require.main === module) {
    databaseReady.then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    }).catch(error => {
        console.error('Failed to initialize database:', error);
        process.exitCode = 1;
    });
}

module.exports = app;
