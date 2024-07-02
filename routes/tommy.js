const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cron = require('node-cron');
const admin = require('firebase-admin');
require('dotenv').config();

const router = express.Router();

// MongoDB Schema for Tommy
const TommySchema = new mongoose.Schema({
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

const Tommy = mongoose.model('Tommy', TommySchema);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'tommy/'); // Update destination folder to 'tommy/'
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Function to send push notification
async function sendNotification(tommy) {
  const message = {
    notification: {
      title: 'New Tommy Offer',
      body: 'Check out the latest Tommy offer!',
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

router.post('/tommyupload', upload.fields([{ name: 'image' }, { name: 'contentimage' }]), async (req, res) => {
  try {
    const { srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller } = req.body;
    const imageSource = req.files.image ? `tommy/${req.files.image[0].filename}` : null;
    const contentimage = req.files.contentimage ? `tommy/${req.files.contentimage[0].filename}` : null;

    const newTommy = new Tommy({ srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller, imageSource, contentimage });
    await newTommy.save();

    // Send notification
    await sendNotification(newTommy);

    res.json(newTommy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/tommydata', async (req, res) => {
  try {
    const tommys = await Tommy.find();
    res.json(tommys);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/tommy-edit/:id', upload.fields([{ name: 'image' }, { name: 'contentimage' }]), async (req, res) => {
  try {
    const { id } = req.params;
    const { srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller } = req.body;

    const tommy = await Tommy.findById(id);
    if (!tommy) return res.status(404).json({ message: 'Tommy offer not found' });

    tommy.title = title;
    tommy.srno = srno;
    tommy.offerPrice = offerPrice;
    tommy.newprice = newprice;
    tommy.truncatedPrice = truncatedPrice;
    tommy.discountPercentage = discountPercentage;
    tommy.discountPrice = discountPrice;
    tommy.ShippingCharge = ShippingCharge;
    tommy.ebayAveragePrice = ebayAveragePrice;
    tommy.eBayTopPrice = eBayTopPrice;
    tommy.eBaySales = eBaySales;
    tommy.ManufacturerPrice = ManufacturerPrice;
    tommy.Seller = Seller;
    tommy.uploadDate = uploadDate;
    tommy.expiryDate = new Date(expiryDate);
    if (req.files.image) {
      tommy.imageSource = `tommy/${req.files.image[0].filename}`;
    }
    if (req.files.contentimage) {
      tommy.contentimage = `tommy/${req.files.contentimage[0].filename}`;
    }
    await tommy.save();

    res.json(tommy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/tommy-delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tommy = await Tommy.findByIdAndDelete(id);

    if (!tommy) return res.status(404).json({ message: 'Tommy offer not found' });

    res.json(tommy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/tommyones', async (req, res) => {
  try {
    const tommy = await Tommy.find({ key: 1 });

    const tommyoffer = tommy.map(tommy => {
      const expiryDate = new Date(tommy.expiryDate);
      const now = new Date();
      const timeDifference = expiryDate - now;

      if (timeDifference <= 0) {
        return {
          ...tommy._doc,
          expiryDate: 'Expired'
        };
      }

      const hours = Math.floor(timeDifference / 1000 / 60 / 60);
      const minutes = Math.floor((timeDifference / 1000 / 60) % 60);
      const finaltime = `${hours}:${minutes.toString().padStart(2, '0')}`;

      return {
        ...tommy._doc,
        expiryDate: finaltime
      };
    });

    res.status(200).json(tommyoffer);
  } catch (error) {
    console.error('Error fetching Tommy offers:', error);
    res.status(500).json({ error: error.message });
  }
});

cron.schedule('* * * * *', async () => {
  try {
    await Tommy.updateMany(
      { expiryDate: { $lt: new Date() }, key: 1 },
      { key: 0 }
    );
  } catch (error) {
    console.error('Error updating expired Tommy offers:', error.message);
  }
});

router.put('/tommy-restore/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller } = req.body;

    const tommy = await Tommy.findById(id);
    if (!tommy) return res.status(404).json({ message: 'Tommy offer not found' });

    tommy.title = title;
    tommy.srno = srno;
    tommy.offerPrice = offerPrice;
    tommy.newprice = newprice;
    tommy.truncatedPrice = truncatedPrice;
    tommy.discountPercentage = discountPercentage;
    tommy.discountPrice = discountPrice;
    tommy.ShippingCharge = ShippingCharge;
    tommy.ebayAveragePrice = ebayAveragePrice;
    tommy.eBayTopPrice = eBayTopPrice;
    tommy.eBaySales = eBaySales;
    tommy.ManufacturerPrice = ManufacturerPrice;
    tommy.Seller = Seller;
    tommy.uploadDate = uploadDate;
    tommy.expiryDate = new Date(expiryDate);
    tommy.key = 1;
    await tommy.save();

    res.json(tommy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
