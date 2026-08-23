const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function initializeDatabase() {
    return new Promise((resolve, reject) => {
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
                    availability INTEGER NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
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
                    const insert = db.prepare(`INSERT INTO frames (name, brand, price, image_url, shape, color, material, availability) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
                    insert.run("Classic Aviator", "Ray-Ban", 150.00, "/images/frames/aviator.png", "Aviator", "Gold", "Metal", 1);
                    insert.run("Wayfarer Classic", "Ray-Ban", 160.00, "/images/frames/wayfarer.png", "Rectangular", "Black", "Acetate", 1);
                    insert.run("Round Metal", "Oakley", 140.00, "/images/frames/round.png", "Round", "Silver", "Metal", 1);
                    insert.run("Clubmaster", "Gucci", 250.00, "/images/frames/clubmaster.png", "Browline", "Tortoise", "Acetate", 1);
                    insert.run("Titan Slim", "Titan", 95.00, "/images/frames/titan.png", "Rectangular", "Gunmetal", "Titanium", 1);
                    insert.run("Cat Eye Luxe", "Prada", 310.00, "/images/frames/cateye.png", "Cat Eye", "Rose Gold", "Metal", 0);
                    insert.run("Geometric Bold", "Versace", 275.00, "/images/frames/geometric.png", "Geometric", "Black", "Acetate", 1);
                    insert.run("Oval Vintage", "Persol", 195.00, "/images/frames/oval.png", "Oval", "Honey Brown", "Acetate", 1);
                    insert.run("Sport Wrap", "Oakley", 120.00, "/images/frames/sport.png", "Wrap", "Matte Black", "Nylon", 1);
                    insert.run("Square Minimalist", "Warby Parker", 85.00, "/images/frames/square.png", "Square", "Crystal Clear", "Acetate", 0);
                    insert.finalize();
                }
            });

            // Insert default Admin user if none exists
            db.get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'", async (err, row) => {
                if (err) return reject(err);
                if (row.count === 0) {
                    const salt = await bcrypt.genSalt(10);
                    const hashedAdminPassword = await bcrypt.hash('admin123', salt);
                    db.run(`INSERT INTO users (full_name, email, password, phone_number, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)`,
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
                resolve();
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
        const sql = `INSERT INTO tryon_history (user_id, frame_id, image_url, cloudinary_public_id, lens_option, color_option, face_shape) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [
            data.userId,
            data.frameId,
            data.imageUrl,
            data.cloudinaryPublicId,
            data.lensOption || 'Clear Lens',
            data.colorOption || null,
            data.faceShape || null
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

function getTryOnHistoryById(id) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM tryon_history WHERE id = ?", [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function deleteTryOnHistory(id) {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM tryon_history WHERE id = ?", [id], function(err) {
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

function findBestInStockAlternative(targetFrame, allFrames) {
    if (!targetFrame) return null;
    const inStockCandidates = allFrames.filter(f => f.id !== targetFrame.id && f.availability == 1);
    if (inStockCandidates.length === 0) return null;

    let bestMatch = null;
    let maxScore = -1;

    inStockCandidates.forEach(cand => {
        let score = 0;
        // Shape match: 40 points
        if (cand.shape && targetFrame.shape && cand.shape.toLowerCase() === targetFrame.shape.toLowerCase()) {
            score += 40;
        }
        // Material match: 25 points
        if (cand.material && targetFrame.material && cand.material.toLowerCase() === targetFrame.material.toLowerCase()) {
            score += 25;
        }
        // Color match: 15 points
        if (cand.color && targetFrame.color && cand.color.toLowerCase() === targetFrame.color.toLowerCase()) {
            score += 15;
        }
        // Price proximity match: up to 20 points
        if (targetFrame.price > 0) {
            const priceDiffRatio = Math.abs(cand.price - targetFrame.price) / targetFrame.price;
            if (priceDiffRatio <= 0.30) {
                score += (1 - (priceDiffRatio / 0.30)) * 20;
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
        material: bestMatch.material
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

                    // Shape match: 40 points
                    if (candidate.shape.toLowerCase() === currentFrame.shape.toLowerCase()) {
                        score += 40;
                    }

                    // Material match: 25 points
                    if (candidate.material.toLowerCase() === currentFrame.material.toLowerCase()) {
                        score += 25;
                    }

                    // Color match: 15 points
                    if (candidate.color.toLowerCase() === currentFrame.color.toLowerCase()) {
                        score += 15;
                    }

                    // Price proximity match: max 20 points
                    // Standard diff ratio within ±30% range
                    if (currentFrame.price > 0) {
                        const priceDiffRatio = Math.abs(candidate.price - currentFrame.price) / currentFrame.price;
                        if (priceDiffRatio <= 0.30) {
                            const priceScore = (1 - (priceDiffRatio / 0.30)) * 20;
                            score += priceScore;
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

function getUserOrders(userId) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT o.*, 
                   COALESCE((SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id), 0) AS total_items
            FROM orders o
            WHERE o.user_id = ? AND o.status != 'Cancelled'
            ORDER BY o.created_at DESC
        `;
        db.all(sql, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
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
        const sql = `UPDATE orders SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status = 'Placed'`;
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
        const sql = `SELECT COUNT(*) AS total_orders FROM orders WHERE user_id = ? AND status != 'Cancelled'`;
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

function getMostTriedFrames(days = 30, limit = 5) {
    return new Promise((resolve, reject) => {
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

                SELECT f.shape AS shape, COUNT(c.id) AS activity_count
                FROM cart c
                INNER JOIN frames f ON c.frame_id = f.id
                WHERE c.created_at >= DATETIME('now', '-' || ? || ' days')
                GROUP BY f.shape
            )
            GROUP BY shape
            ORDER BY total_activity DESC
            LIMIT ?
        `;
        db.all(sql, [days, days, days, limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function getFrequentlyComparedPairs(days = 30, limit = 5) {
    return new Promise((resolve, reject) => {
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

module.exports = {
    initializeDatabase,
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
    addToCart,
    getUserCart,
    updateCartQuantity,
    removeFromCart,
    getCartItemCount,
    clearCart,
    createOrder,
    createOrderItems,
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
    getFrequentlyComparedPairs
};


