const db = require('../models/Database');

exports.renderHome = (req, res) => {
    res.render('home', { title: 'Home | Virtual Eyewear Try-On' });
};

exports.renderAbout = (req, res) => {
    res.render('about', { title: 'About Us' });
};

exports.renderContact = (req, res) => {
    res.render('contact', { title: 'Contact Us' });
};

exports.renderLogin = (req, res) => {
    res.render('login', { title: 'Login' });
};

exports.renderSignup = (req, res) => {
    res.render('signup', { title: 'Sign Up' });
};

exports.renderForgotPassword = (req, res) => {
    res.render('forgot-password', { title: 'Forgot Password' });
};

exports.renderResetPassword = (req, res) => {
    res.render('reset-password', { title: 'Reset Password', token: req.params.token });
};
