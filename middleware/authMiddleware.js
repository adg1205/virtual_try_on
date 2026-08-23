const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_in_production';

exports.verifyToken = (req, res, next) => {
    const token = req.cookies.jwt;
    
    // Disable caching for authenticated routes to prevent back-button issues
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    if (!token) {
        return res.redirect('/login');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        res.locals.user = decoded; // Make user available in all views
        next();
    } catch (err) {
        console.error("JWT Verification failed:", err);
        res.clearCookie('jwt');
        return res.redirect('/login');
    }
};

exports.checkUser = (req, res, next) => {
    const token = req.cookies.jwt;
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            res.locals.user = decoded;
        } catch (err) {
            req.user = null;
            res.locals.user = null;
        }
    } else {
        req.user = null;
        res.locals.user = null;
    }
    next();
};

exports.requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).render('error/403', { title: 'Access Denied' });
        }
        next();
    };
};

// Also export the secret for signing
exports.JWT_SECRET = JWT_SECRET;
