const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cron = require('node-cron');
const admin = require('firebase-admin');
require('dotenv').config();

const router = express.Router(); 

// MongoDB Schema
const CouponsSchema = new mongoose.Schema({
  title: String,
  description: String,
  expiryDate: Date,
  uploadDate: Date,
  srno: Number,
  imageSource: String,
  contentimage: String,
  heading: String,
  subheading: String,
  paragraph: String,
  subparagraph: String,
  key: { type: Number, default: 1 },
});

const Coupons = mongoose.model('Coupons', CouponsSchema);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'coupons/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Function to send push notification
async function sendNotification(coupons) {
  const message = {
    notification: {
      title: 'New Coupons Data',
      body:  'Tap to View It',
    },
    topic: 'segments',
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
  } catch (error) {
    console.log('Error sending message:', error);
  }
}

router.post('/couponsupload', upload.fields([{ name: 'image' }, { name: 'contentimage' }]), async (req, res) => {
  try {
    const { srno, title, description, expiryDate, uploadDate, heading, paragraph, subheading, subparagraph } = req.body;
    const imageSource = req.files.image ? `coupons/${req.files.image[0].filename}` : null;
    const contentimage = req.files.contentimage ? `coupons/${req.files.contentimage[0].filename}` : null;

    const newCoupons = new Coupons({ srno, title, description, expiryDate, uploadDate, heading, paragraph, subheading, subparagraph, imageSource, contentimage });
    await newCoupons.save();

    // Send notification
    await sendNotification(newCoupons);

    res.json(newCoupons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/couponsdata', async (req, res) => {
  try {
    const coupons = await Coupons.find();
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/coupons-edit/:id', upload.fields([{ name: 'image' }, { name: 'contentimage' }]), async (req, res) => {
  try {
    const { id } = req.params;
    const { srno, title, description, expiryDate, uploadDate, heading, paragraph, subheading, subparagraph } = req.body;

    const coupons = await Coupons.findById(id);
    if (!coupons) return res.status(404).json({ message: 'Coupons not found' });

    coupons.title = title;
    coupons.srno = srno;
    coupons.heading = heading;
    coupons.paragraph = paragraph;
    coupons.subheading = subheading;
    coupons.subparagraph = subparagraph;
    coupons.description = description;
    coupons.uploadDate = uploadDate;
    coupons.expiryDate = new Date(expiryDate);  // Ensure expiryDate is a Date
    if (req.files.image) {
      coupons.imageSource = `coupons/${req.files.image[0].filename}`;
    }
    if (req.files.contentimage) {
      coupons.contentimage = `coupons/${req.files.contentimage[0].filename}`;
    }
    await coupons.save();

    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/coupons-delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const coupons = await Coupons.findByIdAndDelete(id);

    if (!coupons) return res.status(404).json({ message: 'Coupons not found' });

    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/couponsone', async (req, res) => {
  try {
    const coupons = await Coupons.find({ key: 1 });

    const formattedCoupons = coupons.map(singleCoupons => {
      const uploadDate = new Date(singleCoupons.uploadDate);

      // Formatting uploadDate
      const formattedUploadDate = uploadDate.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      // Return formatted coupons object
      return {
        ...singleCoupons._doc,
        uploadDate: formattedUploadDate
      };
    });

    res.status(200).json(formattedCoupons);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ error: error.message });
  }
});

cron.schedule('* * * * *', async () => {
  try {
    await Coupons.updateMany(
      { expiryDate: { $lt: new Date() }, key: 1 },
      { key: 0 }
    );
  } catch (error) {
    console.error('Error updating expired coupons:', error.message);
  }
});

router.put('/coupons-restore/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { srno, title, description, expiryDate, uploadDate, heading, paragraph, subheading, subparagraph } = req.body;

    const coupons = await Coupons.findById(id);
    if (!coupons) return res.status(404).json({ message: 'Coupons not found' });

    coupons.title = title;
    coupons.srno = srno;
    coupons.heading = heading;
    coupons.paragraph = paragraph;
    coupons.subheading = subheading;
    coupons.subparagraph = subparagraph;
    coupons.description = description;
    coupons.uploadDate = uploadDate;
    coupons.expiryDate = new Date(expiryDate);
    coupons.key = 1;
    await coupons.save();

    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
