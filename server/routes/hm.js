const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cron = require('node-cron');
const admin = require('firebase-admin');
require('dotenv').config();

const router = express.Router();

// MongoDB Schema
const HMSchema = new mongoose.Schema({
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

const HM = mongoose.model('HM', HMSchema);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'hm/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Function to send push notification
async function sendNotification(hm) {
  const message = {
    notification: {
      title: 'New HM Offer',
      body: 'Check out the latest HM offer!',
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

router.post('/hmupload', upload.fields([{ name: 'image' }, { name: 'contentimage' }]), async (req, res) => {
  try {
    const { srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller } = req.body;
    const imageSource = req.files.image ? `hm/${req.files.image[0].filename}` : null;
    const contentimage = req.files.contentimage ? `hm/${req.files.contentimage[0].filename}` : null;

    const newHM = new HM({ srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller, imageSource, contentimage });
    await newHM.save();

    // Send notification
    await sendNotification(newHM);

    res.json(newHM);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/hmdata', async (req, res) => {
  try {
    const hms = await HM.find();
    res.json(hms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/hm-edit/:id', upload.fields([{ name: 'image' }, { name: 'contentimage' }]), async (req, res) => {
  try {
    const { id } = req.params;
    const { srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller } = req.body;

    const hm = await HM.findById(id);
    if (!hm) return res.status(404).json({ message: 'HM offer not found' });

    hm.title = title;
    hm.srno = srno;
    hm.offerPrice = offerPrice;
    hm.newprice = newprice;
    hm.truncatedPrice = truncatedPrice;
    hm.discountPercentage = discountPercentage;
    hm.discountPrice = discountPrice;
    hm.ShippingCharge = ShippingCharge;
    hm.ebayAveragePrice = ebayAveragePrice;
    hm.eBayTopPrice = eBayTopPrice;
    hm.eBaySales = eBaySales;
    hm.ManufacturerPrice = ManufacturerPrice;
    hm.Seller = Seller;
    hm.uploadDate = uploadDate;
    hm.expiryDate = new Date(expiryDate);  // Ensure expiryDate is a Date
    if (req.files.image) {
      hm.imageSource = `hm/${req.files.image[0].filename}`;
    }
    if (req.files.contentimage) {
      hm.contentimage = `hm/${req.files.contentimage[0].filename}`;
    }
    await hm.save();

    res.json(hm);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/hm-delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const hm = await HM.findByIdAndDelete(id);

    if (!hm) return res.status(404).json({ message: 'HM offer not found' });

    res.json(hm);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/hmones', async (req, res) => {
  try {
    const hm = await HM.find({ key: 1 });

    const hmoffer = hm.map(hm => {
      const expiryDate = new Date(hm.expiryDate);
      const now = new Date();
      const timeDifference = expiryDate - now;

      if (timeDifference <= 0) {
        return {
          ...hm._doc,
          expiryDate: 'Expired'
        };
      }

      const hours = Math.floor(timeDifference / 1000 / 60 / 60);
      const minutes = Math.floor((timeDifference / 1000 / 60) % 60);
      const finaltime = `${hours}:${minutes.toString().padStart(2, '0')}`;

      return {
        ...hm._doc,
        expiryDate: finaltime
      };
    });

    res.status(200).json(hmoffer);
  } catch (error) {
    console.error('Error fetching HM offers:', error);
    res.status(500).json({ error: error.message });
  }
});

cron.schedule('* * * * *', async () => {
  try {
    await HM.updateMany(
      { expiryDate: { $lt: new Date() }, key: 1 },
      { key: 0 }
    );
  } catch (error) {
    console.error('Error updating expired HM offers:', error.message);
  }
});

router.put('/hm-restore/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller } = req.body;

    const hm = await HM.findById(id);
    if (!hm) return res.status(404).json({ message: 'HM offer not found' });

    hm.title = title;
    hm.srno = srno;
    hm.offerPrice = offerPrice;
    hm.newprice = newprice;
    hm.truncatedPrice = truncatedPrice;
    hm.discountPercentage = discountPercentage;
    hm.discountPrice = discountPrice;
    hm.ShippingCharge = ShippingCharge;
    hm.ebayAveragePrice = ebayAveragePrice;
    hm.eBayTopPrice = eBayTopPrice;
    hm.eBaySales = eBaySales;
    hm.ManufacturerPrice = ManufacturerPrice;
    hm.Seller = Seller;
    hm.uploadDate = uploadDate;
    hm.expiryDate = new Date(expiryDate);
    hm.key = 1;
    await hm.save();

    res.json(hm);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
