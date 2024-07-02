const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const User = mongoose.model('User');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Define destination folder for uploaded images
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

// Multer file filter
const fileFilter = (req, file, cb) => {
    // Accept only image files (you can customize this based on file type)
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Multer instance for image uploads
const upload = multer({ storage: storage, fileFilter: fileFilter });

// Route to handle image upload
router.post('/upload-image', upload.single('image'), async (req, res) => {
    try {
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        res.status(201).json({ imageUrl });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Route to serve list of image URLs
router.get('/image-list', (req, res) => {
    const uploadDirectory = path.join(__dirname, '../uploads');

    try {
        // Read the contents of the uploads directory
        fs.readdir(uploadDirectory, (err, files) => {
            if (err) {
                console.error('Error reading upload directory:', err);
                return res.status(500).json({ error: 'Failed to fetch image URLs' });
            }

            // Map filenames to complete URLs
            const imageUrls = files.map((file) => {
                return `${req.protocol}://${req.get('host')}/uploads/${file}`;
            });

            // Respond with the list of image URLs
            res.status(200).json(imageUrls);
        });
    } catch (error) {
        console.error('Error fetching image URLs:', error);
        res.status(500).json({ error: 'Failed to fetch image URLs' });
    }
});

router.delete('/delete-image', (req, res) => {
    const { imageUrl } = req.body;

    if (!imageUrl) {
        return res.status(400).json({ error: 'Image URL is required' });
    }

    const imagePath = path.join(__dirname, '../uploads/', getImageFilenameFromUrl(imageUrl));

    fs.unlink(imagePath, (err) => {
        if (err) {
            console.error('Error deleting image:', err);
            return res.status(500).json({ error: 'Failed to delete image' });
        }

        res.status(200).json({ message: 'Image deleted successfully' });
    });
});

router.post('/replace-image', upload.single('image'), (req, res) => {
    try {
        // Check if a file was uploaded
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        // Extract the filename of the new image
        const newImageFilename = req.file.filename;
        const newImageUrl = `/uploads/${newImageFilename}`;

        // Get the URL of the previous image from the request body
        const previousImageUrl = req.body.previousImageUrl;

        // Delete the previous image file
        if (previousImageUrl) {
            const previousImagePath = path.join(__dirname, '../uploads/', getImageFilenameFromUrl(previousImageUrl));
            fs.unlink(previousImagePath, (err) => {
                if (err) {
                    console.error('Error deleting previous image:', err);
                }
            });
        }

        // Replace logic: Update the existing image URL with the new one in your system
        // For example, update the image URL in your database or storage system

        // Respond with the updated image URL and a success message
        res.status(200).json({ imageUrl: newImageUrl, message: 'Image replaced successfully' });
    } catch (error) {
        console.error('Error replacing image:', error);
        res.status(500).json({ error: 'Failed to replace image' });
    }
});

// Helper function to extract filename from image URL
function getImageFilenameFromUrl(imageUrl) {
    const parts = imageUrl.split('/');
    return parts[parts.length - 1];
}

module.exports = router;