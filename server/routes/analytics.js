const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cron = require('node-cron');
const admin = require('firebase-admin');
require('dotenv').config();

const router = express.Router(); 

// MongoDB Schema
const AnalyticsSchema = new mongoose.Schema({
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

const Analytics = mongoose.model('Analytics', AnalyticsSchema);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'analytics/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Function to send push notification
async function sendNotification(analytics) {
  const message = {
    notification: {
      title: 'New Analytics Data',
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

router.post('/analyticsupload', upload.fields([{ name: 'image' }, { name: 'contentimage' }]), async (req, res) => {
  try {
    const { srno, title, description, expiryDate, uploadDate, heading, paragraph, subheading, subparagraph } = req.body;
    const imageSource = req.files.image ? `analytics/${req.files.image[0].filename}` : null;
    const contentimage = req.files.contentimage ? `analytics/${req.files.contentimage[0].filename}` : null;

    const newAnalytics = new Analytics({ srno, title, description, expiryDate, uploadDate, heading, paragraph, subheading, subparagraph, imageSource, contentimage });
    await newAnalytics.save();

    // Send notification
    await sendNotification(newAnalytics);

    res.json(newAnalytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/analyticsdata', async (req, res) => {
  try {
    const analytics = await Analytics.find();
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/analytics-edit/:id', upload.fields([{ name: 'image' }, { name: 'contentimage' }]), async (req, res) => {
  try {
    const { id } = req.params;
    const { srno, title, description, expiryDate, uploadDate, heading, paragraph, subheading, subparagraph } = req.body;

    const analytics = await Analytics.findById(id);
    if (!analytics) return res.status(404).json({ message: 'Analytics not found' });

    analytics.title = title;
    analytics.srno = srno;
    analytics.heading = heading;
    analytics.paragraph = paragraph;
    analytics.subheading = subheading;
    analytics.subparagraph = subparagraph;
    analytics.description = description;
    analytics.uploadDate = uploadDate;
    analytics.expiryDate = new Date(expiryDate);  // Ensure expiryDate is a Date
    if (req.files.image) {
      analytics.imageSource = `analytics/${req.files.image[0].filename}`;
    }
    if (req.files.contentimage) {
      analytics.contentimage = `analytics/${req.files.contentimage[0].filename}`;
    }
    await analytics.save();

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/analytics-delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const analytics = await Analytics.findByIdAndDelete(id);

    if (!analytics) return res.status(404).json({ message: 'Analytics not found' });

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/analyticsone', async (req, res) => {
  try {
    const analytics = await Analytics.find({ key: 1 });

    const formattedAnalytics = analytics.map(singleAnalytics => {
      const uploadDate = new Date(singleAnalytics.uploadDate);

      // Formatting uploadDate
      const formattedUploadDate = uploadDate.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      // Return formatted analytics object
      return {
        ...singleAnalytics._doc,
        uploadDate: formattedUploadDate
      };
    });

    res.status(200).json(formattedAnalytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

cron.schedule('* * * * *', async () => {
  try {
    await Analytics.updateMany(
      { expiryDate: { $lt: new Date() }, key: 1 },
      { key: 0 }
    );
  } catch (error) {
    console.error('Error updating expired analytics:', error.message);
  }
});

router.put('/analytics-restore/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { srno, title, description, expiryDate, uploadDate, heading, paragraph, subheading, subparagraph } = req.body;

    const analytics = await Analytics.findById(id);
    if (!analytics) return res.status(404).json({ message: 'Analytics not found' });

    analytics.title = title;
    analytics.srno = srno;
    analytics.heading = heading;
    analytics.paragraph = paragraph;
    analytics.subheading = subheading;
    analytics.subparagraph = subparagraph;
    analytics.description = description;
    analytics.uploadDate = uploadDate;
    analytics.expiryDate = new Date(expiryDate);
    analytics.key = 1;
    await analytics.save();

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
