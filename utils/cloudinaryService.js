const cloudinary = require('cloudinary').v2;

// Configure Cloudinary credentials from environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

function isConfigured() {
    return [
        process.env.CLOUDINARY_CLOUD_NAME,
        process.env.CLOUDINARY_API_KEY,
        process.env.CLOUDINARY_API_SECRET
    ].every(value => value && !String(value).startsWith('your_'));
}

/**
 * Uploads a base64 image string to Cloudinary
 * @param {string} base64DataUri - Base64 encoded image data (e.g. "data:image/jpeg;base64,...")
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
async function uploadImage(base64DataUri) {
    try {
        const result = await cloudinary.uploader.upload(base64DataUri, {
            folder: 'tryon-results',
            resource_type: 'image',
            overwrite: false,
            unique_filename: true
        });
        return {
            secure_url: result.secure_url,
            public_id: result.public_id
        };
    } catch (err) {
        console.error('Cloudinary upload error:', err);
        throw err;
    }
}

async function uploadProfileImage(buffer, mimeType) {
    if (!isConfigured()) {
        throw new Error('Cloudinary is not configured for profile uploads.');
    }
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
        throw new Error('A valid profile image buffer is required.');
    }

    const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, {
        folder: 'profile-photos',
        resource_type: 'image',
        overwrite: false,
        unique_filename: true,
        transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' }
        ]
    });
    return {
        secure_url: result.secure_url,
        public_id: result.public_id
    };
}

/**
 * Deletes an image from Cloudinary using its public_id
 * @param {string} publicId - Cloudinary public ID of the resource
 * @returns {Promise<any>}
 */
async function deleteImage(publicId) {
    try {
        if (!publicId) return;
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (err) {
        console.error('Cloudinary delete error:', err);
        throw err;
    }
}

module.exports = {
    isConfigured,
    uploadImage,
    uploadProfileImage,
    deleteImage
};
