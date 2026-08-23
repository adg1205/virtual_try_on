/**
 * Migration Script: Recreate frames table with AI-generated real images
 * Run with: node migrate-frames.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Starting frames table migration...');

db.serialize(() => {
    db.run('DROP TABLE IF EXISTS frames', (err) => {
        if (err) { console.error('Error dropping frames table:', err); db.close(); return; }
        console.log('✅ Old frames table dropped.');
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS frames (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            brand TEXT NOT NULL,
            price REAL NOT NULL,
            image_url TEXT NOT NULL,
            shape TEXT NOT NULL DEFAULT 'Rectangular',
            color TEXT NOT NULL DEFAULT 'Black',
            material TEXT NOT NULL DEFAULT 'Acetate',
            availability INTEGER NOT NULL DEFAULT 1
        )
    `, (err) => {
        if (err) { console.error('Error creating frames table:', err); db.close(); return; }
        console.log('✅ New frames table created.');
    });

    db.serialize(() => {
        const insert = db.prepare(`
            INSERT INTO frames (name, brand, price, image_url, shape, color, material, availability)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const frames = [
            ['Classic Aviator',   'Ray-Ban',      150.00, '/images/frames/aviator.png',    'Aviator',     'Gold',          'Metal',    1],
            ['Wayfarer Classic',  'Ray-Ban',       160.00, '/images/frames/wayfarer.png',   'Rectangular', 'Black',         'Acetate',  1],
            ['Round Metal',       'Oakley',        140.00, '/images/frames/round.png',      'Round',       'Silver',        'Metal',    1],
            ['Clubmaster',        'Gucci',         250.00, '/images/frames/clubmaster.png', 'Browline',    'Tortoise',      'Acetate',  1],
            ['Titan Slim',        'Titan',          95.00, '/images/frames/titan.png',      'Rectangular', 'Gunmetal',      'Titanium', 1],
            ['Cat Eye Luxe',      'Prada',         310.00, '/images/frames/cateye.png',     'Cat Eye',     'Rose Gold',     'Metal',    0],
            ['Geometric Bold',    'Versace',       275.00, '/images/frames/geometric.png',  'Geometric',   'Black',         'Acetate',  1],
            ['Oval Vintage',      'Persol',        195.00, '/images/frames/oval.png',       'Oval',        'Honey Brown',   'Acetate',  1],
            ['Sport Wrap',        'Oakley',        120.00, '/images/frames/sport.png',      'Wrap',        'Matte Black',   'Nylon',    1],
            ['Square Minimalist', 'Warby Parker',   85.00, '/images/frames/square.png',     'Square',      'Crystal Clear', 'Acetate',  0],
        ];

        frames.forEach(frame => insert.run(frame));
        insert.finalize();

        console.log('✅ Inserted 10 frames with real AI-generated images.');
        console.log('🎉 Migration complete! Start the server with: node app.js');
        db.close();
    });
});
