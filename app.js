require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./models/Database');
const indexRoutes = require('./routes/indexRoutes');
const { checkUser } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Set View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
// Serve the pinned Bootstrap distribution locally so the interface remains usable
// without relying on a third-party CDN at runtime.
app.use('/vendor/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cookieParser());

// Disable caching for all routes and enable CORS for static canvas processing
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// Check user global middleware
app.use(checkUser);

// Routes
app.use('/', indexRoutes);

// Initialize DB and start server
db.initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error("Failed to initialize database:", err);
});
