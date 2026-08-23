const db = require('../models/Database');

exports.renderCatalog = async (req, res) => {
    try {
        const frames = await db.getAllFrames();
        res.render('catalog', { title: 'Frame Catalog', frames: frames });
    } catch (err) {
        console.error("Error fetching frames:", err);
        res.status(500).send("Internal Server Error");
    }
};
