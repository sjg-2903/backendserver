const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cron = require('node-cron');
const admin = require('firebase-admin');
require('dotenv').config();

const router = express.Router(); 

// MongoDB Schema
const SegmentSchema = new mongoose.Schema({
  title: String,
  description: String,
  expiryDate: Date,
  imageSource: String,
  key: { type: Number, default: 1 },
});

const Segment = mongoose.model('Segment', SegmentSchema);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'segment/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Function to send push notification
async function sendNotification(segment) {
  const message = {
    notification: {
      title: 'New Segment Added',
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

router.post('/segmentupload', upload.single('image'), async (req, res) => {
  try {
    const { title, description, expiryDate } = req.body;
    const imageSource = req.file ? `segment/${req.file.filename}` : null;

    const newSegment = new Segment({ title, description, expiryDate, imageSource });
    await newSegment.save();

    // Send notification
    await sendNotification(newSegment);

    res.json(newSegment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/segmentdata', async (req, res) => {
  try {
    const segments = await Segment.find();
    res.json(segments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

router.put('/segment-edit/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, expiryDate } = req.body;

    const segment = await Segment.findById(id);
    if (!segment) return res.status(404).json({ message: 'Segment not found' });

    segment.title = title;
    segment.description = description;
    segment.expiryDate = new Date(expiryDate);  // Ensure expiryDate is a Date
    if (req.file) {
      segment.imageSource = `segment/${req.file.filename}`;
    }
    await segment.save();

    res.json(segment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/segment-delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const segment = await Segment.findByIdAndDelete(id);

    if (!segment) return res.status(404).json({ message: 'Segment not found' });

    res.json(segment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/segmentone', async (req, res) => {
  try {
    const segments = await Segment.find({ key: 1 });

    const formattedSegments = segments.map(segment => {
      const expiryDate = new Date(segment.expiryDate);
      const now = new Date();
      const timeDifference = expiryDate - now;

      if (timeDifference <= 0) {
        return {
          ...segment._doc,
          expiryDate: 'Expired'
        };
      }

      const hours = Math.floor(timeDifference / 1000 / 60 / 60);
      const minutes = Math.floor((timeDifference / 1000 / 60) % 60);
      const formattedExpiry = `${hours}:${minutes.toString().padStart(2, '0')}`;

      return {
        ...segment._doc,
        expiryDate: formattedExpiry
      };
    });

    res.status(200).json(formattedSegments);
  } catch (error) {
    console.error('Error fetching segments:', error);
    res.status(500).json({ error: error.message });
  }
});

cron.schedule('* * * * *', async () => {
  try {
    await Segment.updateMany(
      { expiryDate: { $lt: new Date() }, key: 1 },
      { key: 0 }
    );
  } catch (error) {
    console.error('Error updating expired segments:', error.message);
  }
});

router.put('/segment-restore/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, expiryDate } = req.body;

    const segment = await Segment.findById(id);
    if (!segment) return res.status(404).json({ message: 'Segment not found' });

    segment.title = title;
    segment.description = description;
    segment.expiryDate = new Date(expiryDate);
    segment.key = 1;
    await segment.save();

    res.json(segment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
