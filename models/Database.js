const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@tursodatabase/serverless/compat');
const { LibsqlCallbackDatabase, normalizeValue } = require('./LibsqlCallbackDatabase');

const configuredDbPath = process.env.DB_PATH?.trim();
const dbPath = configuredDbPath
    ? (path.isAbsolute(configuredDbPath)
        ? configuredDbPath
        : path.resolve(__dirname, '..', configuredDbPath))
    : path.join(__dirname, '..', 'database.sqlite');
const tursoDatabaseUrl = process.env.TURSO_DATABASE_URL?.trim();
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN?.trim();
const usesTurso = Boolean(tursoDatabaseUrl);
const tursoClient = usesTurso
    ? createClient({
        url: tursoDatabaseUrl,
        authToken: tursoAuthToken || undefined
    })
    : null;

if (process.env.VERCEL && !usesTurso) {
    throw new Error('TURSO_DATABASE_URL is required on Vercel because local SQLite storage is not persistent.');
}
if (process.env.VERCEL && !tursoAuthToken) {
    throw new Error('TURSO_AUTH_TOKEN is required on Vercel to authenticate database requests.');
}

// sqlite3 ships a native binary and is only needed for local development.
// Loading it in a Turso-backed Vercel function can fail against Vercel's GLIBC
// version even though production never uses the local database.
const sqlite3 = usesTurso ? null : require('sqlite3').verbose();
const db = usesTurso
    ? new LibsqlCallbackDatabase(tursoClient)
    : new sqlite3.Database(dbPath);

function closeDatabase() {
    return new Promise((resolve, reject) => {
        db.close((error) => error ? reject(error) : resolve());
    });
}

function ensureColumn(tableName, columnName, definition) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName})`, (error, columns) => {
            if (error) return reject(error);
            if (columns.some(column => column.name === columnName)) return resolve();
            db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`, (alterError) => {
                if (alterError) reject(alterError);
                else resolve();
            });
        });
    });
}

async function ensureCustomerFeatureColumns() {
    await ensureColumn('tryon_history', 'overlay_settings', "TEXT NOT NULL DEFAULT '{}'");
    await ensureColumn('orders', 'payment_status', "TEXT DEFAULT 'unpaid'");
    await ensureColumn('orders', 'cancellation_requested_at', 'DATETIME');
}

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        let framesReady = false;
        let schemaReady = false;

        const resolveWhenReady = () => {
            if (framesReady && schemaReady) resolve();
        };

        db.serialize(async () => {
            // Create Frames table
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
                    size TEXT NOT NULL DEFAULT 'Medium',
                    availability INTEGER NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) return reject(err);
            });

            // Backward-compatible migration for databases created before frame
            // size became part of the catalog and similarity criteria. SQLite
            // does not support ADD COLUMN IF NOT EXISTS, so the duplicate-column
            // error is intentionally ignored for current databases.
            db.run('ALTER TABLE frames ADD COLUMN size TEXT NOT NULL DEFAULT \'Medium\'', (err) => {
                if (err && !/duplicate column name/i.test(err.message)) {
                    return reject(err);
                }
            });

            // Give the bundled legacy records meaningful size values.
            db.run(`
                UPDATE frames
                SET size = CASE name
                    WHEN 'Classic Aviator' THEN 'Large'
                    WHEN 'Round Metal' THEN 'Small'
                    WHEN 'Geometric Bold' THEN 'Large'
                    WHEN 'Oval Vintage' THEN 'Small'
                    WHEN 'Sport Wrap' THEN 'Large'
                    ELSE size
                END
                WHERE size IS NULL OR TRIM(size) = '' OR size = 'Medium'
            `, (err) => {
                if (err) return reject(err);
            });

            // Ensure created_at exists for existing databases
            db.all("PRAGMA table_info(frames)", (err, columns) => {
                if (err) return reject(err);
                const hasCreatedAt = columns && columns.some(col => col.name === 'created_at');
                if (!hasCreatedAt) {
                    db.run("ALTER TABLE frames ADD COLUMN created_at DATETIME", (alterErr) => {
                        if (alterErr) console.error("Error adding created_at:", alterErr);
                        else {
                            db.run("UPDATE frames SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL");
                        }
                    });
                }
            });

            // Create Users table
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    full_name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    phone_number TEXT NOT NULL,
                    address TEXT,
                    profile_photo TEXT,
                    role TEXT NOT NULL DEFAULT 'customer',
                    is_verified INTEGER DEFAULT 0,
                    verification_token TEXT,
                    reset_token TEXT,
                    reset_token_expiry INTEGER
                )
            `, (err) => {
                if (err) return reject(err);
            });

            // Check if there's data, if not insert dummy frames
            db.get("SELECT COUNT(*) AS count FROM frames", (err, row) => {
                if (err) return reject(err);
                if (row.count === 0) {
                    const insert = db.prepare(`INSERT OR IGNORE INTO frames (id, name, brand, price, image_url, shape, color, material, size, availability) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                    insert.run(1, "Classic Aviator", "Ray-Ban", 150.00, "/images/frames/aviator.png", "Aviator", "Gold", "Metal", "Large", 1);
                    insert.run(2, "Wayfarer Classic", "Ray-Ban", 160.00, "/images/frames/wayfarer.png", "Rectangular", "Black", "Acetate", "Medium", 1);
                    insert.run(3, "Round Metal", "Oakley", 140.00, "/images/frames/round.png", "Round", "Silver", "Metal", "Small", 1);
                    insert.run(4, "Clubmaster", "Gucci", 250.00, "/images/frames/clubmaster.png", "Browline", "Tortoise", "Acetate", "Medium", 1);
                    insert.run(5, "Titan Slim", "Titan", 95.00, "/images/frames/titan.png", "Rectangular", "Gunmetal", "Titanium", "Medium", 1);
                    insert.run(6, "Cat Eye Luxe", "Prada", 310.00, "/images/frames/cateye.png", "Cat Eye", "Rose Gold", "Metal", "Medium", 0);
                    insert.run(7, "Geometric Bold", "Versace", 275.00, "/images/frames/geometric.png", "Geometric", "Black", "Acetate", "Large", 1);
                    insert.run(8, "Oval Vintage", "Persol", 195.00, "/images/frames/oval.png", "Oval", "Honey Brown", "Acetate", "Small", 1);
                    insert.run(9, "Sport Wrap", "Oakley", 120.00, "/images/frames/sport.png", "Wrap", "Matte Black", "Nylon", "Large", 1);
                    insert.run(10, "Square Minimalist", "Warby Parker", 85.00, "/images/frames/square.png", "Square", "Crystal Clear", "Acetate", "Medium", 0);
                    insert.finalize((insertErr) => {
                        if (insertErr) return reject(insertErr);
                        framesReady = true;
                        resolveWhenReady();
                    });
                } else {
                    framesReady = true;
                    resolveWhenReady();
                }
            });

            // Insert default Admin user if none exists
            db.get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'", async (err, row) => {
                if (err) return reject(err);
                if (row.count === 0) {
                    const salt = await bcrypt.genSalt(10);
                    const hashedAdminPassword = await bcrypt.hash('admin123', salt);
                    db.run(`INSERT OR IGNORE INTO users (full_name, email, password, phone_number, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)`,
                        ['System Admin', 'admin@example.com', hashedAdminPassword, '0000000000', 'admin', 1]
                    );
                }
            });

            // Create Wishlist table
            db.run(`
                CREATE TABLE IF NOT EXISTS wishlist (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    frame_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, frame_id),
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY(frame_id) REFERENCES frames(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject(err);
            });

            // Create TryOn History table
            db.run(`
                CREATE TABLE IF NOT EXISTS tryon_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    frame_id INTEGER NOT NULL,
                    image_url TEXT NOT NULL,
                    cloudinary_public_id TEXT NOT NULL,
                    lens_option TEXT DEFAULT 'Clear Lens',
                    color_option TEXT,
                    face_shape TEXT,
                    overlay_settings TEXT NOT NULL DEFAULT '{}',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY(frame_id) REFERENCES frames(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject(err);
            });

            // Create Cart table
            db.run(`
                CREATE TABLE IF NOT EXISTS cart (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    frame_id INTEGER NOT NULL,
                    lens_option TEXT NOT NULL DEFAULT 'Clear Lens',
                    quantity INTEGER NOT NULL DEFAULT 1,
                    price REAL NOT NULL,
                    selected_variant TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, frame_id, lens_option, selected_variant),
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY(frame_id) REFERENCES frames(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject(err);
            });

            // Create Orders table
            db.run(`
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    order_number TEXT UNIQUE NOT NULL,
                    delivery_address TEXT NOT NULL,
                    contact_number TEXT NOT NULL,
                    order_note TEXT,
                    payment_method TEXT NOT NULL,
                    subtotal REAL NOT NULL,
                    delivery_charge REAL NOT NULL DEFAULT 0,
                    total_amount REAL NOT NULL,
                    status TEXT NOT NULL DEFAULT 'Placed',
                    payment_status TEXT DEFAULT 'unpaid',
                    cancellation_requested_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject(err);
            });

            // Create Order Items table
            db.run(`
                CREATE TABLE IF NOT EXISTS order_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER NOT NULL,
                    frame_id INTEGER,
                    frame_name TEXT NOT NULL,
                    brand TEXT,
                    image_url TEXT,
                    lens_option TEXT,
                    selected_variant TEXT,
                    quantity INTEGER NOT NULL DEFAULT 1,
                    unit_price REAL NOT NULL,
                    line_total REAL NOT NULL,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
                    FOREIGN KEY(frame_id) REFERENCES frames(id) ON DELETE SET NULL
                )
            `, (err) => {
                if (err) return reject(err);
            });

            // Check & add payment_status column to orders table
            db.all("PRAGMA table_info(orders)", (err, columns) => {
                if (!err && columns) {
                    const hasPaymentStatus = columns.some(col => col.name === 'payment_status');
                    if (!hasPaymentStatus) {
                        db.run("ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'unpaid'");
                    }
                }
            });

            // Create Reviews table
            db.run(`
                CREATE TABLE IF NOT EXISTS reviews (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    frame_id INTEGER NOT NULL,
                    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
                    comment TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, frame_id),
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY(frame_id) REFERENCES frames(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject(err);
            });

            // Create Payments table
            db.run(`
                CREATE TABLE IF NOT EXISTS payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER NOT NULL,
                    transaction_id TEXT NOT NULL,
                    payment_method TEXT NOT NULL,
                    payment_gateway TEXT NOT NULL,
                    amount REAL NOT NULL,
                    currency TEXT NOT NULL DEFAULT 'BDT',
                    status TEXT NOT NULL DEFAULT 'completed',
                    gateway_response TEXT,
                    paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject(err);
            });

            // Prevent duplicate orders when a gateway sends both a browser
            // success callback and an IPN for the same transaction.
            db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_transaction_id
                    ON payments(transaction_id)`, (err) => {
                if (err) return reject(err);
            });

            // Create Frame Comparisons table
            db.run(`
                CREATE TABLE IF NOT EXISTS frame_comparisons (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    frame_id_1 INTEGER NOT NULL,
                    frame_id_2 INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY(frame_id_1) REFERENCES frames(id) ON DELETE CASCADE,
                    FOREIGN KEY(frame_id_2) REFERENCES frames(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject(err);
                ensureCustomerFeatureColumns()
                    .then(() => {
                        schemaReady = true;
                        resolveWhenReady();
                    })
                    .catch(reject);
            });
        });
    });
}

function getAllFrames() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM frames", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getAllFramesSorted(sortBy) {
    return new Promise((resolve, reject) => {
        let sql = "SELECT * FROM frames ORDER BY id ASC";
        
        switch (sortBy) {
            case 'price_asc':
                sql = "SELECT * FROM frames ORDER BY price ASC";
                break;
            case 'price_desc':
                sql = "SELECT * FROM frames ORDER BY price DESC";
                break;
            case 'newest':
                sql = "SELECT * FROM frames ORDER BY created_at DESC, id DESC";
                break;
            case 'availability':
                sql = "SELECT * FROM frames ORDER BY availability DESC, name ASC";
                break;
            case 'popularity':
                sql = `
                    SELECT f.*, COUNT(w.id) AS wishlist_count 
                    FROM frames f 
                    LEFT JOIN wishlist w ON f.id = w.frame_id 
                    GROUP BY f.id 
                    ORDER BY wishlist_count DESC, f.id ASC
                `;
                break;
            case 'most_tried':
                sql = `
                    SELECT f.*, COUNT(t.id) AS tryon_count 
                    FROM frames f 
                    LEFT JOIN tryon_history t ON f.id = t.frame_id 
                    GROUP BY f.id 
                    ORDER BY tryon_count DESC, f.id ASC
                `;
                break;
        }

        db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getFrameById(id) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM frames WHERE id = ?", [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function createUser(userData) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO users (full_name, email, password, phone_number, address, profile_photo, role, verification_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [
            userData.full_name, 
            userData.email, 
            userData.password, 
            userData.phone_number, 
            userData.address || null, 
            userData.profile_photo || null, 
            userData.role || 'customer',
            userData.verification_token || null
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function getUserById(id) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

function getUserByEmail(email) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function getUserByVerificationToken(token) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE verification_token = ?", [token], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function updateUserVerification(userId) {
    return new Promise((resolve, reject) => {
        db.run("UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?", [userId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function updateResetToken(email, token, expiry) {
    return new Promise((resolve, reject) => {
        db.run("UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?", [token, expiry, email], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function getUserByResetToken(token) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > ?", [token, Date.now()], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function updateUserPassword(userId, hashedPassword) {
    return new Promise((resolve, reject) => {
        db.run("UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?", [hashedPassword, userId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function addToWishlist(userId, frameId) {
    return new Promise((resolve, reject) => {
        db.run("INSERT OR IGNORE INTO wishlist (user_id, frame_id) VALUES (?, ?)", [userId, frameId], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function removeFromWishlist(userId, frameId) {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM wishlist WHERE user_id = ? AND frame_id = ?", [userId, frameId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function getUserWishlist(userId) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT f.* FROM frames f
            INNER JOIN wishlist w ON f.id = w.frame_id
            WHERE w.user_id = ?
            ORDER BY w.created_at DESC
        `;
        db.all(sql, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getFramesByShapes(shapesArray) {
    return new Promise((resolve, reject) => {
        if (!shapesArray || shapesArray.length === 0) {
            return resolve([]);
        }
        const placeholders = shapesArray.map(() => '?').join(', ');
        const sql = `SELECT * FROM frames WHERE shape IN (${placeholders}) AND availability = 1`;
        db.all(sql, shapesArray, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getUserWishlistIds(userId) {
    return new Promise((resolve, reject) => {
        db.all("SELECT frame_id FROM wishlist WHERE user_id = ?", [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(r => r.frame_id));
        });
    });
}

function saveTryOnResult(data) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO tryon_history (user_id, frame_id, image_url, cloudinary_public_id, lens_option, color_option, face_shape, overlay_settings) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [
            data.userId,
            data.frameId,
            data.imageUrl,
            data.cloudinaryPublicId,
            data.lensOption || 'Clear Lens',
            data.colorOption || null,
            data.faceShape || null,
            data.overlaySettings || '{}'
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function getUserTryOnHistory(userId) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT h.*, f.name AS frame_name, f.brand, f.price, f.shape AS frame_shape, f.image_url AS frame_catalog_image
            FROM tryon_history h
            INNER JOIN frames f ON h.frame_id = f.id
            WHERE h.user_id = ?
            ORDER BY h.created_at DESC
        `;
        db.all(sql, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getTryOnHistoryById(id, userId = null) {
    return new Promise((resolve, reject) => {
        const sql = userId === null
            ? "SELECT * FROM tryon_history WHERE id = ?"
            : "SELECT * FROM tryon_history WHERE id = ? AND user_id = ?";
        const params = userId === null ? [id] : [id, userId];
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function deleteTryOnHistory(id, userId = null) {
    return new Promise((resolve, reject) => {
        const sql = userId === null
            ? "DELETE FROM tryon_history WHERE id = ?"
            : "DELETE FROM tryon_history WHERE id = ? AND user_id = ?";
        const params = userId === null ? [id] : [id, userId];
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function getUserTryOnCount(userId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT COUNT(*) AS count FROM tryon_history WHERE user_id = ?", [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.count : 0);
        });
    });
}

function getLatestTryOnForFrame(userId, frameId) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM tryon_history WHERE user_id = ? AND frame_id = ? ORDER BY created_at DESC LIMIT 1`;
        db.get(sql, [userId, frameId], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

// The comparison matrix shows a try-on preview for every selected frame, so it
// needs the newest capture per frame in a single round trip rather than one
// query per column. Selecting on MAX(id) keeps the newest row unambiguous when
// two captures share a created_at second.
function getLatestTryOnsForUser(userId) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT frame_id, image_url, lens_option, color_option, face_shape, created_at
            FROM tryon_history t
            WHERE t.user_id = ?
              AND t.id = (
                  SELECT MAX(t2.id) FROM tryon_history t2
                  WHERE t2.user_id = t.user_id AND t2.frame_id = t.frame_id
              )
        `;
        db.all(sql, [userId], (err, rows) => {
            if (err) return reject(err);
            const byFrameId = {};
            (rows || []).forEach(row => {
                byFrameId[row.frame_id] = row;
            });
            resolve(byFrameId);
        });
    });
}

function findBestInStockAlternative(targetFrame, allFrames) {
    if (!targetFrame) return null;
    const inStockCandidates = allFrames.filter(f => f.id !== targetFrame.id && f.availability == 1);
    if (inStockCandidates.length === 0) return null;

    let bestMatch = null;
    let maxScore = -1;

    inStockCandidates.forEach(cand => {
        let score = 0;
        // Shape match: 30 points
        if (cand.shape && targetFrame.shape && cand.shape.toLowerCase() === targetFrame.shape.toLowerCase()) {
            score += 30;
        }
        // Material match: 20 points
        if (cand.material && targetFrame.material && cand.material.toLowerCase() === targetFrame.material.toLowerCase()) {
            score += 20;
        }
        // Color match: 15 points
        if (cand.color && targetFrame.color && cand.color.toLowerCase() === targetFrame.color.toLowerCase()) {
            score += 15;
        }
        // Size match: 20 points
        if (cand.size && targetFrame.size && cand.size.toLowerCase() === targetFrame.size.toLowerCase()) {
            score += 20;
        }
        // Price proximity match: up to 15 points
        if (targetFrame.price > 0) {
            const priceDiffRatio = Math.abs(cand.price - targetFrame.price) / targetFrame.price;
            if (priceDiffRatio <= 0.30) {
                score += (1 - (priceDiffRatio / 0.30)) * 15;
            }
        }

        if (score > maxScore) {
            maxScore = score;
            bestMatch = cand;
        }
    });

    if (!bestMatch) return null;
    return {
        id: bestMatch.id,
        name: bestMatch.name,
        brand: bestMatch.brand,
        image_url: bestMatch.image_url,
        price: bestMatch.price,
        shape: bestMatch.shape,
        color: bestMatch.color,
        material: bestMatch.material,
        size: bestMatch.size
    };
}

function getSimilarFrames(frameId, limit = 4) {
    return new Promise(async (resolve, reject) => {
        try {
            const currentFrame = await getFrameById(frameId);
            if (!currentFrame) {
                return resolve([]);
            }

            db.all("SELECT * FROM frames WHERE id != ?", [frameId], (err, candidates) => {
                if (err) return reject(err);

                const scoredCandidates = candidates.map(candidate => {
                    let score = 0;
                    const matchReasons = [];

                    // Shape match: 30 points
                    if (candidate.shape && currentFrame.shape && candidate.shape.toLowerCase() === currentFrame.shape.toLowerCase()) {
                        score += 30;
                        matchReasons.push('shape');
                    }

                    // Material match: 20 points
                    if (candidate.material && currentFrame.material && candidate.material.toLowerCase() === currentFrame.material.toLowerCase()) {
                        score += 20;
                        matchReasons.push('material');
                    }

                    // Color match: 15 points
                    if (candidate.color && currentFrame.color && candidate.color.toLowerCase() === currentFrame.color.toLowerCase()) {
                        score += 15;
                        matchReasons.push('color');
                    }

                    // Size match: 20 points
                    if (candidate.size && currentFrame.size && candidate.size.toLowerCase() === currentFrame.size.toLowerCase()) {
                        score += 20;
                        matchReasons.push('size');
                    }

                    // Price proximity match: max 15 points
                    // Standard diff ratio within ±30% range
                    if (currentFrame.price > 0) {
                        const priceDiffRatio = Math.abs(candidate.price - currentFrame.price) / currentFrame.price;
                        if (priceDiffRatio <= 0.30) {
                            const priceScore = (1 - (priceDiffRatio / 0.30)) * 15;
                            score += priceScore;
                            matchReasons.push('price');
                        }
                    }

                    let similarityScore = Math.round(score);
                    const isOutOfStock = candidate.availability == 0;

                    // Apply 50% penalty for out-of-stock frames
                    if (isOutOfStock) {
                        similarityScore = Math.round(similarityScore * 0.5);
                    }

                    return {
                        ...candidate,
                        similarityScore,
                        matchReasons,
                        isOutOfStock
                    };
                });

                // Filter out candidates with similarityScore < 10%
                const filteredCandidates = scoredCandidates.filter(c => c.similarityScore >= 10);

                // Sort descending by score
                filteredCandidates.sort((a, b) => b.similarityScore - a.similarityScore);

                const topResults = filteredCandidates.slice(0, limit).map(item => {
                    if (item.isOutOfStock) {
                        return {
                            ...item,
                            alternative: findBestInStockAlternative(item, candidates)
                        };
                    }
                    return item;
                });

                // Return top results up to limit
                resolve(topResults);
            });
        } catch (err) {
            reject(err);
        }
    });
}

function addToCart(userId, item) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO cart (user_id, frame_id, lens_option, quantity, price, selected_variant, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, frame_id, lens_option, selected_variant) DO UPDATE SET
                quantity = quantity + excluded.quantity,
                price = excluded.price,
                updated_at = CURRENT_TIMESTAMP
        `;
        db.run(sql, [
            userId,
            item.frameId,
            item.lensOption || 'Clear Lens',
            item.quantity || 1,
            item.price,
            item.selectedVariant || null
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function getUserCart(userId) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT c.*, f.name AS frame_name, f.brand, f.image_url AS frame_catalog_image, f.availability
            FROM cart c
            INNER JOIN frames f ON c.frame_id = f.id
            WHERE c.user_id = ?
            ORDER BY c.updated_at DESC, c.created_at DESC
        `;
        db.all(sql, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function updateCartQuantity(userId, cartId, quantity) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE cart SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`;
        db.run(sql, [quantity, cartId, userId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function removeFromCart(userId, cartId) {
    return new Promise((resolve, reject) => {
        const sql = `DELETE FROM cart WHERE id = ? AND user_id = ?`;
        db.run(sql, [cartId, userId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function getCartItemCount(userId) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT COALESCE(SUM(quantity), 0) AS total_items FROM cart WHERE user_id = ?`;
        db.get(sql, [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.total_items : 0);
        });
    });
}

function clearCart(userId) {
    return new Promise((resolve, reject) => {
        const sql = `DELETE FROM cart WHERE user_id = ?`;
        db.run(sql, [userId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function createOrder(orderData) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO orders (user_id, order_number, delivery_address, contact_number, order_note, payment_method, subtotal, delivery_charge, total_amount, status, payment_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(sql, [
            orderData.userId,
            orderData.orderNumber,
            orderData.deliveryAddress,
            orderData.contactNumber,
            orderData.orderNote || null,
            orderData.paymentMethod,
            orderData.subtotal,
            orderData.deliveryCharge,
            orderData.totalAmount,
            orderData.status || 'Placed',
            orderData.paymentStatus || (orderData.paymentMethod === 'cod' ? 'unpaid' : 'paid')
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function createOrderItems(orderId, items) {
    return new Promise((resolve, reject) => {
        if (!items || items.length === 0) return resolve();
        
        const stmt = db.prepare(`
            INSERT INTO order_items (order_id, frame_id, frame_name, brand, image_url, lens_option, selected_variant, quantity, unit_price, line_total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        db.serialize(() => {
            let errorOccurred = false;
            items.forEach(item => {
                const lineTotal = item.price * item.quantity;
                stmt.run([
                    orderId,
                    item.frame_id,
                    item.frame_name,
                    item.brand,
                    item.frame_catalog_image || item.image_url,
                    item.lens_option,
                    item.selected_variant,
                    item.quantity,
                    item.price,
                    lineTotal
                ], (err) => {
                    if (err && !errorOccurred) {
                        errorOccurred = true;
                        stmt.finalize();
                        return reject(err);
                    }
                });
            });
            if (!errorOccurred) {
                stmt.finalize((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }
        });
    });
}

/**
 * Creates an order, snapshots every cart line, optionally stores a verified
 * gateway payment, and clears the cart as one SQLite transaction. A failure at
 * any point rolls back the complete checkout.
 */
async function createTursoOrderTransaction(orderData, items, paymentData = null) {
    const transaction = await tursoClient.transaction('write');
    try {
        const orderResult = await transaction.execute({
            sql: `
                INSERT INTO orders (
                    user_id, order_number, delivery_address, contact_number,
                    order_note, payment_method, subtotal, delivery_charge,
                    total_amount, status, payment_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
            `,
            args: [
                orderData.userId,
                orderData.orderNumber,
                orderData.deliveryAddress,
                orderData.contactNumber,
                orderData.orderNote || null,
                orderData.paymentMethod,
                orderData.subtotal,
                orderData.deliveryCharge,
                orderData.totalAmount,
                orderData.status || 'Placed',
                orderData.paymentStatus || 'unpaid'
            ]
        });
        const orderId = normalizeValue(orderResult.rows[0]?.id ?? orderResult.lastInsertRowid);
        if (!orderId) throw new Error('Turso did not return the new order ID');

        const statements = items.map(item => ({
            sql: `
                INSERT INTO order_items (
                    order_id, frame_id, frame_name, brand, image_url,
                    lens_option, selected_variant, quantity, unit_price, line_total
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                orderId,
                item.frame_id,
                item.frame_name,
                item.brand,
                item.frame_catalog_image || item.image_url,
                item.lens_option,
                item.selected_variant,
                item.quantity,
                item.price,
                Number(item.price) * Number(item.quantity)
            ]
        }));

        if (paymentData) {
            statements.push({
                sql: `
                    INSERT INTO payments (
                        order_id, transaction_id, payment_method,
                        payment_gateway, amount, currency, status,
                        gateway_response, paid_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    orderId,
                    paymentData.transactionId,
                    paymentData.paymentMethod,
                    paymentData.paymentGateway,
                    paymentData.amount,
                    paymentData.currency || 'BDT',
                    paymentData.status || 'completed',
                    paymentData.gatewayResponse || null,
                    paymentData.paidAt || new Date().toISOString()
                ]
            });
        }
        statements.push({
            sql: 'DELETE FROM cart WHERE user_id = ?',
            args: [orderData.userId]
        });

        await transaction.batch(statements);
        await transaction.commit();
        return orderId;
    } catch (error) {
        if (!transaction.closed) await transaction.rollback();
        throw error;
    } finally {
        if (!transaction.closed) transaction.close();
    }
}

function createOrderTransaction(orderData, items, paymentData = null) {
    if (usesTurso) {
        if (!Array.isArray(items) || items.length === 0) {
            return Promise.reject(new Error('Cannot create an order from an empty cart'));
        }
        return createTursoOrderTransaction(orderData, items, paymentData);
    }

    return new Promise((resolve, reject) => {
        if (!Array.isArray(items) || items.length === 0) {
            return reject(new Error('Cannot create an order from an empty cart'));
        }

        const transactionDb = new sqlite3.Database(dbPath);
        let settled = false;
        const rollback = (error) => {
            if (settled) return;
            settled = true;
            transactionDb.run('ROLLBACK', () => {
                transactionDb.close(() => reject(error));
            });
        };

        transactionDb.serialize(() => {
            transactionDb.run('BEGIN IMMEDIATE TRANSACTION', (beginError) => {
                if (beginError) {
                    settled = true;
                    return transactionDb.close(() => reject(beginError));
                }

                const orderSql = `
                    INSERT INTO orders (
                        user_id, order_number, delivery_address, contact_number,
                        order_note, payment_method, subtotal, delivery_charge,
                        total_amount, status, payment_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const orderParams = [
                    orderData.userId,
                    orderData.orderNumber,
                    orderData.deliveryAddress,
                    orderData.contactNumber,
                    orderData.orderNote || null,
                    orderData.paymentMethod,
                    orderData.subtotal,
                    orderData.deliveryCharge,
                    orderData.totalAmount,
                    orderData.status || 'Placed',
                    orderData.paymentStatus || 'unpaid'
                ];

                transactionDb.run(orderSql, orderParams, function(orderError) {
                    if (orderError) return rollback(orderError);
                    const orderId = this.lastID;
                    let itemError = null;
                    const itemStatement = transactionDb.prepare(`
                        INSERT INTO order_items (
                            order_id, frame_id, frame_name, brand, image_url,
                            lens_option, selected_variant, quantity, unit_price, line_total
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `);

                    items.forEach(item => {
                        const lineTotal = Number(item.price) * Number(item.quantity);
                        itemStatement.run([
                            orderId,
                            item.frame_id,
                            item.frame_name,
                            item.brand,
                            item.frame_catalog_image || item.image_url,
                            item.lens_option,
                            item.selected_variant,
                            item.quantity,
                            item.price,
                            lineTotal
                        ], (error) => {
                            if (error && !itemError) itemError = error;
                        });
                    });

                    itemStatement.finalize((finalizeError) => {
                        if (itemError || finalizeError) {
                            return rollback(itemError || finalizeError);
                        }

                        const clearCartAndCommit = () => {
                            transactionDb.run('DELETE FROM cart WHERE user_id = ?', [orderData.userId], (clearError) => {
                                if (clearError) return rollback(clearError);

                                transactionDb.run('COMMIT', (commitError) => {
                                    if (commitError) return rollback(commitError);
                                    settled = true;
                                    transactionDb.close((closeError) => {
                                        if (closeError) return reject(closeError);
                                        resolve(orderId);
                                    });
                                });
                            });
                        };

                        if (!paymentData) {
                            return clearCartAndCommit();
                        }

                        const paymentSql = `
                            INSERT INTO payments (
                                order_id, transaction_id, payment_method,
                                payment_gateway, amount, currency, status,
                                gateway_response, paid_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `;
                        transactionDb.run(paymentSql, [
                            orderId,
                            paymentData.transactionId,
                            paymentData.paymentMethod,
                            paymentData.paymentGateway,
                            paymentData.amount,
                            paymentData.currency || 'BDT',
                            paymentData.status || 'completed',
                            paymentData.gatewayResponse || null,
                            paymentData.paidAt || new Date().toISOString()
                        ], (paymentError) => {
                            if (paymentError) return rollback(paymentError);
                            clearCartAndCommit();
                        });
                    });
                });
            });
        });
    });
}

function createOrderFromCart(orderData, items) {
    return createOrderTransaction(orderData, items);
}

function createPaidOrderFromCart(orderData, items, paymentData) {
    if (!paymentData || !paymentData.transactionId) {
        return Promise.reject(new Error('A verified gateway payment is required'));
    }
    return createOrderTransaction(orderData, items, paymentData);
}

function getUserOrders(userId) {
    return new Promise((resolve, reject) => {
        // Keep cancelled records for administrative/payment history, but remove
        // them from the customer's active order history.
        const sql = `
            SELECT o.*
            FROM orders o
            WHERE o.user_id = ?
              AND o.status NOT IN ('Cancelled', 'Cancellation Requested')
            ORDER BY o.created_at DESC
        `;
        db.all(sql, [userId], (err, rows) => {
            if (err) reject(err);
            else if (!rows.length) resolve([]);
            else {
                const placeholders = rows.map(() => '?').join(', ');
                db.all(
                    `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
                    rows.map(order => order.id),
                    (itemsError, items) => {
                        if (itemsError) return reject(itemsError);
                        const itemsByOrder = new Map();
                        for (const item of items) {
                            if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
                            itemsByOrder.get(item.order_id).push(item);
                        }
                        resolve(rows.map(order => {
                            const orderItems = itemsByOrder.get(order.id) || [];
                            return {
                                ...order,
                                items: orderItems,
                                total_items: orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
                            };
                        }));
                    }
                );
            }
        });
    });
}

function getOrderById(orderId, userId = null) {
    return new Promise((resolve, reject) => {
        let orderSql = `SELECT * FROM orders WHERE id = ?`;
        let params = [orderId];
        if (userId) {
            orderSql = `SELECT * FROM orders WHERE id = ? AND user_id = ?`;
            params = [orderId, userId];
        }
        db.get(orderSql, params, (err, order) => {
            if (err) return reject(err);
            if (!order) return resolve(null);

            const itemsSql = `SELECT * FROM order_items WHERE order_id = ?`;
            db.all(itemsSql, [orderId], (err, items) => {
                if (err) return reject(err);

                const paymentSql = `SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`;
                db.get(paymentSql, [orderId], (pErr, payment) => {
                    resolve({ ...order, items, payment: payment || null });
                });
            });
        });
    });
}

function cancelOrder(orderId, userId) {
    return new Promise((resolve, reject) => {
        const sql = `
            UPDATE orders
            SET status = 'Cancelled',
                cancellation_requested_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND user_id = ?
              AND status IN ('Placed', 'Confirmed')
        `;
        db.run(sql, [orderId, userId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function updateOrderStatus(orderId, status) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [status, orderId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function checkReviewEligibility(userId, frameId) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT 
                (SELECT COUNT(*) FROM tryon_history WHERE user_id = ? AND frame_id = ?) AS tryon_count,
                (SELECT COUNT(*) FROM order_items oi INNER JOIN orders o ON oi.order_id = o.id WHERE o.user_id = ? AND oi.frame_id = ?) AS order_count
        `;
        db.get(sql, [userId, frameId, userId, frameId], (err, row) => {
            if (err) reject(err);
            else {
                const isEligible = (row.tryon_count > 0 || row.order_count > 0);
                resolve(isEligible);
            }
        });
    });
}

function createOrUpdateReview(userId, frameId, rating, comment) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO reviews (user_id, frame_id, rating, comment, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, frame_id) DO UPDATE SET
                rating = excluded.rating,
                comment = excluded.comment,
                updated_at = CURRENT_TIMESTAMP
        `;
        db.run(sql, [userId, frameId, rating, comment || null], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function getFrameReviews(frameId, limit = 5, offset = 0) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT r.*, u.full_name, u.profile_photo
            FROM reviews r
            INNER JOIN users u ON r.user_id = u.id
            WHERE r.frame_id = ?
            ORDER BY r.updated_at DESC
            LIMIT ? OFFSET ?
        `;
        db.all(sql, [frameId, limit, offset], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getFrameReviewStats(frameId) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT 
                COUNT(*) AS total_reviews,
                COALESCE(AVG(rating), 0) AS average_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS count_5,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS count_4,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS count_3,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS count_2,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS count_1
            FROM reviews
            WHERE frame_id = ?
        `;
        db.get(sql, [frameId], (err, row) => {
            if (err) reject(err);
            else resolve(row || { total_reviews: 0, average_rating: 0, count_5: 0, count_4: 0, count_3: 0, count_2: 0, count_1: 0 });
        });
    });
}

function getUserReviewForFrame(userId, frameId) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM reviews WHERE user_id = ? AND frame_id = ?`;
        db.get(sql, [userId, frameId], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

function deleteReview(reviewId, userId) {
    return new Promise((resolve, reject) => {
        const sql = `DELETE FROM reviews WHERE id = ? AND user_id = ?`;
        db.run(sql, [reviewId, userId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function getUserOrderCount(userId) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT COUNT(*) AS total_orders
            FROM orders
            WHERE user_id = ?
              AND status NOT IN ('Cancelled', 'Cancellation Requested')
        `;
        db.get(sql, [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.total_orders : 0);
        });
    });
}

function createPayment(paymentData) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO payments (order_id, transaction_id, payment_method, payment_gateway, amount, currency, status, gateway_response, paid_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(sql, [
            paymentData.orderId,
            paymentData.transactionId,
            paymentData.paymentMethod,
            paymentData.paymentGateway,
            paymentData.amount,
            paymentData.currency || 'BDT',
            paymentData.status || 'completed',
            paymentData.gatewayResponse || null,
            paymentData.paidAt || new Date().toISOString()
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function getPaymentByOrderId(orderId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1", [orderId], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

function getPaymentByTransactionId(transactionId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM payments WHERE transaction_id = ?", [transactionId], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

function updateOrderPaymentStatus(orderId, paymentStatus) {
    return new Promise((resolve, reject) => {
        db.run("UPDATE orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [paymentStatus, orderId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function getUserInteractedFrameIds(userId) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT DISTINCT frame_id FROM (
                SELECT frame_id FROM wishlist WHERE user_id = ?
                UNION
                SELECT frame_id FROM tryon_history WHERE user_id = ?
                UNION
                SELECT frame_id FROM cart WHERE user_id = ?
                UNION
                SELECT oi.frame_id FROM order_items oi INNER JOIN orders o ON oi.order_id = o.id WHERE o.user_id = ? AND oi.frame_id IS NOT NULL AND o.status != 'Cancelled'
            )
        `;
        db.all(sql, [userId, userId, userId, userId], (err, rows) => {
            if (err) reject(err);
            else resolve((rows || []).map(r => r.frame_id));
        });
    });
}

function getUserRecentActivity(userId, limit = 5) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT * FROM (
                SELECT t.frame_id, f.name AS frame_name, f.brand, f.price, f.image_url, f.shape, 'Try-On' AS activity_type, t.created_at AS activity_time
                FROM tryon_history t
                INNER JOIN frames f ON t.frame_id = f.id
                WHERE t.user_id = ?

                UNION ALL

                SELECT w.frame_id, f.name AS frame_name, f.brand, f.price, f.image_url, f.shape, 'Wishlist' AS activity_type, w.created_at AS activity_time
                FROM wishlist w
                INNER JOIN frames f ON w.frame_id = f.id
                WHERE w.user_id = ?

                UNION ALL

                SELECT c.frame_id, f.name AS frame_name, f.brand, f.price, f.image_url, f.shape, 'Cart' AS activity_type, c.created_at AS activity_time
                FROM cart c
                INNER JOIN frames f ON c.frame_id = f.id
                WHERE c.user_id = ?
            )
            ORDER BY activity_time DESC
            LIMIT ?
        `;
        db.all(sql, [userId, userId, userId, limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function getPersonalizedRecommendations(userId, limit = 4) {
    return new Promise(async (resolve, reject) => {
        try {
            // 1. Get interacted frame IDs and activity rows with frame metadata
            const sqlActivity = `
                SELECT f.id, f.name, f.brand, f.shape, f.color, f.material, f.price, 'tryon' AS source, 2 AS weight
                FROM tryon_history t
                INNER JOIN frames f ON t.frame_id = f.id
                WHERE t.user_id = ?

                UNION ALL

                SELECT f.id, f.name, f.brand, f.shape, f.color, f.material, f.price, 'wishlist' AS source, 3 AS weight
                FROM wishlist w
                INNER JOIN frames f ON w.frame_id = f.id
                WHERE w.user_id = ?

                UNION ALL

                SELECT f.id, f.name, f.brand, f.shape, f.color, f.material, f.price, 'cart' AS source, 4 AS weight
                FROM cart c
                INNER JOIN frames f ON c.frame_id = f.id
                WHERE c.user_id = ?

                UNION ALL

                SELECT f.id, f.name, f.brand, f.shape, f.color, f.material, f.price, 'order' AS source, 5 AS weight
                FROM order_items oi
                INNER JOIN orders o ON oi.order_id = o.id
                INNER JOIN frames f ON oi.frame_id = f.id
                WHERE o.user_id = ? AND oi.frame_id IS NOT NULL AND o.status != 'Cancelled'
            `;

            db.all(sqlActivity, [userId, userId, userId, userId], async (err, activities) => {
                if (err) return reject(err);

                if (!activities || activities.length === 0) {
                    return resolve({ recommendations: [], hasActivity: false });
                }

                const interactedSet = new Set(activities.map(a => a.id));

                // 2. Build feature preference weights
                const shapeWeights = {};
                const materialWeights = {};
                const colorWeights = {};
                const brandWeights = {};
                let totalPrice = 0;

                activities.forEach(act => {
                    const w = act.weight;
                    shapeWeights[act.shape] = (shapeWeights[act.shape] || 0) + w;
                    materialWeights[act.material] = (materialWeights[act.material] || 0) + w;
                    colorWeights[act.color] = (colorWeights[act.color] || 0) + w;
                    brandWeights[act.brand] = (brandWeights[act.brand] || 0) + w;
                    totalPrice += act.price;
                });

                const avgPrice = totalPrice / activities.length;

                // Find top preferences for label generation
                const topShape = Object.keys(shapeWeights).reduce((a, b) => shapeWeights[a] > shapeWeights[b] ? a : b, '');
                const topBrand = Object.keys(brandWeights).reduce((a, b) => brandWeights[a] > brandWeights[b] ? a : b, '');
                const topMaterial = Object.keys(materialWeights).reduce((a, b) => materialWeights[a] > materialWeights[b] ? a : b, '');

                // 3. Fetch candidate frames (all frames, not already in interacted set)
                db.all("SELECT * FROM frames", [], (cErr, candidates) => {
                    if (cErr) return reject(cErr);

                    let candidatePool = candidates.filter(c => !interactedSet.has(c.id));
                    
                    // Fallback if candidate pool empty (e.g. user interacted with all frames)
                    if (candidatePool.length === 0) {
                        candidatePool = candidates;
                    }

                    // Max weight sums for normalization
                    const maxShapeW = Math.max(...Object.values(shapeWeights), 1);
                    const maxMatW = Math.max(...Object.values(materialWeights), 1);
                    const maxBrandW = Math.max(...Object.values(brandWeights), 1);
                    const maxColorW = Math.max(...Object.values(colorWeights), 1);

                    const scored = candidatePool.map(candidate => {
                        let score = 0;
                        let reason = '✨ Recommended for your style';

                        // Shape match (up to 35 pts)
                        const sW = shapeWeights[candidate.shape] || 0;
                        const shapeScore = (sW / maxShapeW) * 35;
                        score += shapeScore;

                        // Material match (up to 20 pts)
                        const mW = materialWeights[candidate.material] || 0;
                        const matScore = (mW / maxMatW) * 20;
                        score += matScore;

                        // Brand match (up to 15 pts)
                        const bW = brandWeights[candidate.brand] || 0;
                        const brandScore = (bW / maxBrandW) * 15;
                        score += brandScore;

                        // Color match (up to 15 pts)
                        const cW = colorWeights[candidate.color] || 0;
                        const colorScore = (cW / maxColorW) * 15;
                        score += colorScore;

                        // Price proximity match (up to 15 pts)
                        if (avgPrice > 0) {
                            const diffRatio = Math.abs(candidate.price - avgPrice) / avgPrice;
                            if (diffRatio <= 0.40) {
                                score += (1 - (diffRatio / 0.40)) * 15;
                            }
                        }

                        let finalScore = Math.round(score);
                        const isOutOfStock = candidate.availability == 0;

                        // Apply 50% penalty for out-of-stock frames
                        if (isOutOfStock) {
                            finalScore = Math.round(finalScore * 0.5);
                        }

                        // Determine primary reason tag based on highest contributing component
                        if (shapeScore >= 20 && candidate.shape === topShape) {
                            reason = `🎯 Matches your preferred ${candidate.shape} shape`;
                        } else if (brandScore >= 10 && candidate.brand === topBrand) {
                            reason = `🏷️ Popular from your favorite brand (${candidate.brand})`;
                        } else if (matScore >= 12 && candidate.material === topMaterial) {
                            reason = `💎 Crafted in ${candidate.material} based on your choices`;
                        } else if (sW > 0) {
                            reason = `📸 Similar style to your recent activity`;
                        } else if (cW > 0) {
                            reason = `🎨 Suits your color preference (${candidate.color})`;
                        } else {
                            reason = `✨ Curated match for your optical profile`;
                        }

                        return {
                            ...candidate,
                            score: finalScore,
                            recommendationReason: reason,
                            isOutOfStock
                        };
                    });

                    // Sort descending by score
                    scored.sort((a, b) => b.score - a.score);

                    const recommendations = scored.slice(0, limit).map(rec => {
                        if (rec.isOutOfStock) {
                            return {
                                ...rec,
                                alternative: findBestInStockAlternative(rec, candidates)
                            };
                        }
                        return rec;
                    });

                    resolve({
                        recommendations,
                        hasActivity: true
                    });
                });
            });
        } catch (err) {
            reject(err);
        }
    });
}

function logFrameComparison(userId, frameId1, frameId2) {
    return new Promise((resolve, reject) => {
        const id1 = Math.min(parseInt(frameId1, 10), parseInt(frameId2, 10));
        const id2 = Math.max(parseInt(frameId1, 10), parseInt(frameId2, 10));
        if (isNaN(id1) || isNaN(id2) || id1 === id2) return resolve(0);
        const sql = `INSERT INTO frame_comparisons (user_id, frame_id_1, frame_id_2) VALUES (?, ?, ?)`;
        db.run(sql, [userId, id1, id2], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function normalizeAnalyticsRange(value, fallback, minimum, maximum) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
        ? parsed
        : fallback;
}

function getMostTriedFrames(days = 30, limit = 5) {
    return new Promise((resolve, reject) => {
        days = normalizeAnalyticsRange(days, 30, 1, 365);
        limit = normalizeAnalyticsRange(limit, 5, 1, 20);
        const sql = `
            SELECT f.*, COUNT(t.id) AS tryon_count
            FROM frames f
            INNER JOIN tryon_history t ON f.id = t.frame_id
            WHERE t.created_at >= DATETIME('now', '-' || ? || ' days')
            GROUP BY f.id
            ORDER BY tryon_count DESC, f.name ASC
            LIMIT ?
        `;
        db.all(sql, [days, limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function getMostWishlistedFrames(days = 30, limit = 5) {
    return new Promise((resolve, reject) => {
        days = normalizeAnalyticsRange(days, 30, 1, 365);
        limit = normalizeAnalyticsRange(limit, 5, 1, 20);
        const sql = `
            SELECT f.*, COUNT(w.id) AS wishlist_count
            FROM frames f
            INNER JOIN wishlist w ON f.id = w.frame_id
            WHERE w.created_at >= DATETIME('now', '-' || ? || ' days')
            GROUP BY f.id
            ORDER BY wishlist_count DESC, f.name ASC
            LIMIT ?
        `;
        db.all(sql, [days, limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function getTrendingShapes(days = 30, limit = 5) {
    return new Promise((resolve, reject) => {
        days = normalizeAnalyticsRange(days, 30, 1, 365);
        limit = normalizeAnalyticsRange(limit, 5, 1, 20);
        const sql = `
            SELECT shape, SUM(activity_count) AS total_activity FROM (
                SELECT f.shape AS shape, COUNT(t.id) AS activity_count
                FROM tryon_history t
                INNER JOIN frames f ON t.frame_id = f.id
                WHERE t.created_at >= DATETIME('now', '-' || ? || ' days')
                GROUP BY f.shape

                UNION ALL

                SELECT f.shape AS shape, COUNT(w.id) AS activity_count
                FROM wishlist w
                INNER JOIN frames f ON w.frame_id = f.id
                WHERE w.created_at >= DATETIME('now', '-' || ? || ' days')
                GROUP BY f.shape

                UNION ALL

                SELECT f.shape AS shape, SUM(c.quantity) AS activity_count
                FROM cart c
                INNER JOIN frames f ON c.frame_id = f.id
                WHERE c.created_at >= DATETIME('now', '-' || ? || ' days')
                GROUP BY f.shape

                UNION ALL

                SELECT f.shape AS shape, SUM(oi.quantity) AS activity_count
                FROM orders o
                INNER JOIN order_items oi ON oi.order_id = o.id
                INNER JOIN frames f ON oi.frame_id = f.id
                WHERE o.created_at >= DATETIME('now', '-' || ? || ' days')
                  AND o.status != 'Cancelled'
                GROUP BY f.shape

                UNION ALL

                SELECT f.shape AS shape, COUNT(fc.id) AS activity_count
                FROM frame_comparisons fc
                INNER JOIN frames f ON fc.frame_id_1 = f.id
                WHERE fc.created_at >= DATETIME('now', '-' || ? || ' days')
                GROUP BY f.shape

                UNION ALL

                SELECT f.shape AS shape, COUNT(fc.id) AS activity_count
                FROM frame_comparisons fc
                INNER JOIN frames f ON fc.frame_id_2 = f.id
                WHERE fc.created_at >= DATETIME('now', '-' || ? || ' days')
                GROUP BY f.shape
            )
            GROUP BY shape
            ORDER BY total_activity DESC
            LIMIT ?
        `;
        db.all(sql, [days, days, days, days, days, days, limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function getFrequentlyComparedPairs(days = 30, limit = 5) {
    return new Promise((resolve, reject) => {
        days = normalizeAnalyticsRange(days, 30, 1, 365);
        limit = normalizeAnalyticsRange(limit, 5, 1, 20);
        const sql = `
            SELECT 
                fc.frame_id_1, fc.frame_id_2, COUNT(fc.id) AS compare_count,
                f1.name AS f1_name, f1.brand AS f1_brand, f1.image_url AS f1_image, f1.price AS f1_price, f1.shape AS f1_shape,
                f2.name AS f2_name, f2.brand AS f2_brand, f2.image_url AS f2_image, f2.price AS f2_price, f2.shape AS f2_shape
            FROM frame_comparisons fc
            INNER JOIN frames f1 ON fc.frame_id_1 = f1.id
            INNER JOIN frames f2 ON fc.frame_id_2 = f2.id
            WHERE fc.created_at >= DATETIME('now', '-' || ? || ' days')
            GROUP BY fc.frame_id_1, fc.frame_id_2
            ORDER BY compare_count DESC
            LIMIT ?
        `;
        db.all(sql, [days, limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

async function getPopularityIndicators(days = 30, limit = 5) {
    const normalizedDays = normalizeAnalyticsRange(days, 30, 1, 365);
    const normalizedLimit = normalizeAnalyticsRange(limit, 5, 1, 20);
    const [mostTried, mostWishlisted, trendingShapes, comparedPairs] = await Promise.all([
        getMostTriedFrames(normalizedDays, normalizedLimit),
        getMostWishlistedFrames(normalizedDays, normalizedLimit),
        getTrendingShapes(normalizedDays, normalizedLimit),
        getFrequentlyComparedPairs(normalizedDays, normalizedLimit)
    ]);

    return {
        windowDays: normalizedDays,
        limit: normalizedLimit,
        mostTried,
        mostWishlisted,
        trendingShapes,
        comparedPairs
    };
}

module.exports = {
    initializeDatabase,
    closeDatabase,
    getAllFrames,
    getAllFramesSorted,
    getFrameById,
    getFramesByShapes,
    getSimilarFrames,
    createUser,
    getUserById,
    getUserByEmail,
    getUserByVerificationToken,
    updateUserVerification,
    updateResetToken,
    getUserByResetToken,
    updateUserPassword,
    addToWishlist,
    removeFromWishlist,
    getUserWishlist,
    getUserWishlistIds,
    saveTryOnResult,
    getUserTryOnHistory,
    getTryOnHistoryById,
    deleteTryOnHistory,
    getUserTryOnCount,
    getLatestTryOnForFrame,
    getLatestTryOnsForUser,
    addToCart,
    getUserCart,
    updateCartQuantity,
    removeFromCart,
    getCartItemCount,
    clearCart,
    createOrder,
    createOrderItems,
    createOrderFromCart,
    createPaidOrderFromCart,
    getUserOrders,
    getUserOrderCount,
    getOrderById,
    cancelOrder,
    updateOrderStatus,
    checkReviewEligibility,
    createOrUpdateReview,
    getFrameReviews,
    getFrameReviewStats,
    getUserReviewForFrame,
    deleteReview,
    createPayment,
    getPaymentByOrderId,
    getPaymentByTransactionId,
    updateOrderPaymentStatus,
    getUserInteractedFrameIds,
    getUserRecentActivity,
    getPersonalizedRecommendations,
    logFrameComparison,
    getMostTriedFrames,
    getMostWishlistedFrames,
    getTrendingShapes,
    getFrequentlyComparedPairs,
    getPopularityIndicators
};
