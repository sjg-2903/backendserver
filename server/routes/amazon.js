const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cron = require('node-cron');
const admin = require('firebase-admin');
require('dotenv').config();

const router = express.Router();

// Import Amazon model
const AmazonSchema = new mongoose.Schema({
  title: String,
  expiryDate: Date,
  uploadDate: Date,
  srno: Number,
  imageSource: String,
  contentimage: String,
  offerPrice: String,
  newprice: String,
  truncatedPrice: String,
  discountPercentage: String,
  discountPrice: String,
  ShippingCharge: String,
  ebayAveragePrice: String,
  eBayTopPrice: String,
  eBaySales: String,
  ManufacturerPrice: String,
  Seller: String,
  key: { type: Number, default: 1 },
});

const Amazon = mongoose.model('Amazon', AmazonSchema);

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'amazon/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Function to send push notification
async function sendNotification(amazon) {
  const message = {
    notification: {
      title: 'New Amazon Offer',
      body: 'Check out the latest Amazon offer!',
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

// Route to upload Amazon offer
router.post('/amazonupload', upload.fields([{ name: 'image' }, { name: 'contentimage' }]), async (req, res) => {
  try {
    const { srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller } = req.body;
    const imageSource = req.files.image ? `amazon/${req.files.image[0].filename}` : null;
    const contentimage = req.files.contentimage ? `amazon/${req.files.contentimage[0].filename}` : null;

    const newAmazon = new Amazon({ srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller, imageSource, contentimage });
    await newAmazon.save();

    // Send notification
    await sendNotification(newAmazon);

    res.json(newAmazon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route to get all Amazon offers
router.get('/amazondata', async (req, res) => {
  try {
    const amazons = await Amazon.find();
    res.json(amazons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route to edit Amazon offer
router.put('/amazon-edit/:id', upload.fields([{ name: 'image' }, { name: 'contentimage' }]), async (req, res) => {
  try {
    const { id } = req.params;
    const { srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller } = req.body;

    const amazon = await Amazon.findById(id);
    if (!amazon) return res.status(404).json({ message: 'Amazon offer not found' });

    amazon.title = title;
    amazon.srno = srno;
    amazon.offerPrice = offerPrice;
    amazon.newprice = newprice;
    amazon.truncatedPrice = truncatedPrice;
    amazon.discountPercentage = discountPercentage;
    amazon.discountPrice = discountPrice;
    amazon.ShippingCharge = ShippingCharge;
    amazon.ebayAveragePrice = ebayAveragePrice;
    amazon.eBayTopPrice = eBayTopPrice;
    amazon.eBaySales = eBaySales;
    amazon.ManufacturerPrice = ManufacturerPrice;
    amazon.Seller = Seller;
    amazon.uploadDate = uploadDate;
    amazon.expiryDate = new Date(expiryDate);  // Ensure expiryDate is a Date
    if (req.files.image) {
      amazon.imageSource = `amazon/${req.files.image[0].filename}`;
    }
    if (req.files.contentimage) {
      amazon.contentimage = `amazon/${req.files.contentimage[0].filename}`;
    }
    await amazon.save();

    res.json(amazon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route to delete Amazon offer
router.delete('/amazon-delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const amazon = await Amazon.findByIdAndDelete(id);

    if (!amazon) return res.status(404).json({ message: 'Amazon offer not found' });

    res.json(amazon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route to get single Amazon offer
router.get('/amazonone', async (req, res) => {
  try {
    const amazon = await Amazon.find({ key: 1 });

    const amazonoffer = amazon.map(amazon => {
      const expiryDate = new Date(amazon.expiryDate);
      const now = new Date();
      const timeDifference = expiryDate - now;

      if (timeDifference <= 0) {
        return {
          ...amazon._doc,
          expiryDate: 'Expired'
        };
      }

      const hours = Math.floor(timeDifference / 1000 / 60 / 60);
      const minutes = Math.floor((timeDifference / 1000 / 60) % 60);
      const finaltime = `${hours}:${minutes.toString().padStart(2, '0')}`;

      return {
        ...amazon._doc,
        expiryDate: finaltime
      };
    });

    res.status(200).json(amazonoffer);
  } catch (error) {
    console.error('Error fetching amazon offers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cron job to update expired Amazon offers
cron.schedule('* * * * *', async () => {
  try {
    await Amazon.updateMany(
      { expiryDate: { $lt: new Date() }, key: 1 },
      { key: 0 }
    );
  } catch (error) {
    console.error('Error updating expired amazon offers:', error.message);
  }
});

// Route to restore Amazon offer
router.put('/amazon-restore/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller } = req.body;

    const amazon = await Amazon.findById(id);
    if (!amazon) return res.status(404).json({ message: 'Amazon offer not found' });

    amazon.title = title;
    amazon.srno = srno;
    amazon.offerPrice = offerPrice;
    amazon.newprice = newprice;
    amazon.truncatedPrice = truncatedPrice;
    amazon.discountPercentage = discountPercentage;
    amazon.discountPrice = discountPrice;
    amazon.ShippingCharge = ShippingCharge;
    amazon.ebayAveragePrice = ebayAveragePrice;
    amazon.eBayTopPrice = eBayTopPrice;
    amazon.eBaySales = eBaySales;
    amazon.ManufacturerPrice = ManufacturerPrice;
    amazon.Seller = Seller;
    amazon.uploadDate = uploadDate;
    amazon.expiryDate = new Date(expiryDate);
    amazon.key = 1;
    await amazon.save();

    res.json(amazon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
