const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cron = require('node-cron');
const admin = require('firebase-admin');
require('dotenv').config();

const router = express.Router(); 

// MongoDB Schema
const NewsSchema = new mongoose.Schema({
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

const News = mongoose.model('News', NewsSchema);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'news/newspage/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Function to send push notification
async function sendNotification(news) {
  const message = {
    notification: {
      title: 'Breaking News',
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

router.post('/newsupload', upload.fields([{ name: 'image' }, { name: 'contentimage' }]), async (req, res) => {
  try {
    const { srno, title, description, expiryDate, uploadDate, heading, paragraph, subheading, subparagraph } = req.body;
    const imageSource = req.files.image ? `news/newspage/${req.files.image[0].filename}` : null;
    const contentimage = req.files.contentimage ? `news/newspage/${req.files.contentimage[0].filename}` : null;

    const newNews = new News({ srno, title, description, expiryDate, uploadDate, heading, paragraph, subheading, subparagraph, imageSource, contentimage });
    await newNews.save();

    // Send notification
    await sendNotification(newNews);

    res.json(newNews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/newsdata', async (req, res) => {
  try {
    const news = await News.find();
    res.json(news);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/news-edit/:id', upload.fields([{ name: 'image' }, { name: 'contentimage' }]), async (req, res) => {
  try {
    const { id } = req.params;
    const { srno, title, description, expiryDate, uploadDate, heading, paragraph, subheading, subparagraph } = req.body;

    const news = await News.findById(id);
    if (!news) return res.status(404).json({ message: 'News not found' });

    news.title = title;
    news.srno = srno;
    news.heading = heading;
    news.paragraph = paragraph;
    news.subheading = subheading;
    news.subparagraph = subparagraph;
    news.description = description;
    news.uploadDate = uploadDate;
    news.expiryDate = new Date(expiryDate);  // Ensure expiryDate is a Date
    if (req.files.image) {
      news.imageSource = `news/newspage/${req.files.image[0].filename}`;
    }
    if (req.files.contentimage) {
      news.contentimage = `news/newspage/${req.files.contentimage[0].filename}`;
    }
    await news.save();

    res.json(news);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/news-delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const news = await News.findByIdAndDelete(id);

    if (!news) return res.status(404).json({ message: 'News not found' });

    res.json(news);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/newone', async (req, res) => {
  try {
    const news = await News.find({ key: 1 });

    const formattedNews = news.map(singleNews => {
      const uploadDate = new Date(singleNews.uploadDate);

      // Formatting uploadDate
      const formattedUploadDate = uploadDate.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      // Return formatted news object
      return {
        ...singleNews._doc,
        uploadDate: formattedUploadDate
      };
    });

    res.status(200).json(formattedNews);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: error.message });
  }
});

cron.schedule('* * * * *', async () => {
  try {
    await News.updateMany(
      { expiryDate: { $lt: new Date() }, key: 1 },
      { key: 0 }
    );
  } catch (error) {
    console.error('Error updating expired news:', error.message);
  }
});

router.put('/news-restore/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { srno, title, description, expiryDate, uploadDate, heading, paragraph, subheading, subparagraph } = req.body;

    const news = await News.findById(id);
    if (!news) return res.status(404).json({ message: 'News not found' });

    news.title = title;
    news.srno = srno;
    news.heading = heading;
    news.paragraph = paragraph;
    news.subheading = subheading;
    news.subparagraph = subparagraph;
    news.description = description;
    news.uploadDate = uploadDate;
    news.expiryDate = new Date(expiryDate);
    news.key = 1;
    await news.save();

    res.json(news);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
