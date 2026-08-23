const cloudinary = require('cloudinary').v2;

// Configure Cloudinary credentials from environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a base64 image string to Cloudinary
 * @param {string} base64DataUri - Base64 encoded image data (e.g. "data:image/jpeg;base64,...")
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
async function uploadImage(base64DataUri) {
    try {
        const result = await cloudinary.uploader.upload(base64DataUri, {
            folder: 'tryon-results',
            resource_type: 'image'
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
    uploadImage,
    deleteImage
};
