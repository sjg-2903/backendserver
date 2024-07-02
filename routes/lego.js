const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cron = require('node-cron');
const admin = require('firebase-admin');
require('dotenv').config();

const router = express.Router(); 

// MongoDB Schema
const LegoSchema = new mongoose.Schema({
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

const Lego = mongoose.model('Lego', LegoSchema);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'lego/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Function to send push notification
async function sendNotification(lego) {
  const message = {
    notification: {
      title: 'New Lego Offer',
      body: 'Check out the latest Lego offer!',
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

router.post('/legoupload', upload.fields([{ name: 'image' }, { name: 'contentimage' }]), async (req, res) => {
  try {
    const { srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller } = req.body;
    const imageSource = req.files.image ? `lego/${req.files.image[0].filename}` : null;
    const contentimage = req.files.contentimage ? `lego/${req.files.contentimage[0].filename}` : null;

    const newLego = new Lego({ srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller, imageSource, contentimage });
    await newLego.save();

    // Send notification
    await sendNotification(newLego);

    res.json(newLego);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/legodata', async (req, res) => {
  try {
    const legos = await Lego.find();
    res.json(legos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/lego-edit/:id', upload.fields([{ name: 'image' }, { name: 'contentimage' }]), async (req, res) => {
  try {
    const { id } = req.params;
    const { srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller } = req.body;

    const lego = await Lego.findById(id);
    if (!lego) return res.status(404).json({ message: 'Lego offer not found' });

    lego.title = title;
    lego.srno = srno;
    lego.offerPrice = offerPrice;
    lego.newprice = newprice;
    lego.truncatedPrice = truncatedPrice;
    lego.discountPercentage = discountPercentage;
    lego.discountPrice = discountPrice;
    lego.ShippingCharge = ShippingCharge;
    lego.ebayAveragePrice = ebayAveragePrice;
    lego.eBayTopPrice = eBayTopPrice;
    lego.eBaySales = eBaySales;
    lego.ManufacturerPrice = ManufacturerPrice;
    lego.Seller = Seller;
    lego.uploadDate = uploadDate;
    lego.expiryDate = new Date(expiryDate);  // Ensure expiryDate is a Date
    if (req.files.image) {
      lego.imageSource = `lego/${req.files.image[0].filename}`;
    }
    if (req.files.contentimage) {
      lego.contentimage = `lego/${req.files.contentimage[0].filename}`;
    }
    await lego.save();

    res.json(lego);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/lego-delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const lego = await Lego.findByIdAndDelete(id);

    if (!lego) return res.status(404).json({ message: 'Lego offer not found' });

    res.json(lego);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/legoone', async (req, res) => {
  try {
    const lego = await Lego.find({ key: 1 });

    const legotoy = lego.map(lego => {
      const expiryDate = new Date(lego.expiryDate);
      const now = new Date();
      const timeDifference = expiryDate - now;

      if (timeDifference <= 0) {
        return {
          ...lego._doc,
          expiryDate: 'Expired'
        };
      }

      const hours = Math.floor(timeDifference / 1000 / 60 / 60);
      const minutes = Math.floor((timeDifference / 1000 / 60) % 60);
      const toytime = `${hours}:${minutes.toString().padStart(2, '0')}`;

      const uploadDate = new Date(lego.uploadDate);

      // Formatting uploadDate
      const ToyUploadDate = uploadDate.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      return {
        ...lego._doc,
        expiryDate:toytime,
        uploadDate:ToyUploadDate
      };
    });

    res.status(200).json(legotoy);
  } catch (error) {
    console.error('Error fetching lego offers:', error);
    res.status(500).json({ error: error.message });
  }
});

cron.schedule('* * * * *', async () => {
  try {
    await Lego.updateMany(
      { expiryDate: { $lt: new Date() }, key: 1 },
      { key: 0 }
    );
  } catch (error) {
    console.error('Error updating expired lego offers:', error.message);
  }
});

router.put('/lego-restore/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { srno, title, expiryDate, uploadDate, offerPrice, newprice, truncatedPrice, discountPercentage, discountPrice, ShippingCharge, ebayAveragePrice, eBayTopPrice, eBaySales, ManufacturerPrice, Seller } = req.body;

    const lego = await Lego.findById(id);
    if (!lego) return res.status(404).json({ message: 'Lego offer not found' });

    lego.title = title;
    lego.srno = srno;
    lego.offerPrice = offerPrice;
    lego.newprice = newprice;
    lego.truncatedPrice = truncatedPrice;
    lego.discountPercentage = discountPercentage;
    lego.discountPrice = discountPrice;
    lego.ShippingCharge = ShippingCharge;
    lego.ebayAveragePrice = ebayAveragePrice;
    lego.eBayTopPrice = eBayTopPrice;
    lego.eBaySales = eBaySales;
    lego.ManufacturerPrice = ManufacturerPrice;
    lego.Seller = Seller;
    lego.uploadDate = uploadDate;
    lego.expiryDate = new Date(expiryDate);
    lego.key = 1;
    await lego.save();

    res.json(lego);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
