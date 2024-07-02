const express = require('express');
const port = 3005;
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const admin = require('firebase-admin');

const serviceAccount = require('./config/serviceAccountkey.js'); 
console.log(serviceAccount)


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://reselling-de-default-rtdb.firebaseio.com/"  // Update with your database URL
});


// Require middleware and routes
require('./db');
require('./models/User');
const authRoutes = require('./routes/authRoutes');
const banner = require('./routes/banner');
const store = require('./routes/store');
const company = require('./routes/company');
const segment = require('./routes/segment');
const news = require('./routes/news');
const amazon = require('./routes/amazon');
const lego = require('./routes/lego');
const hm = require('./routes/hm');
const tommy = require('./routes/tommy');
const analytics = require('./routes/analytics');
const coupons = require('./routes/coupons');
const requireToken = require('./Middlewares/AuthTokenRequired');
const { getLocalIpAddress } = require('./utils');
 const localIpAddress = getLocalIpAddress();
 console.log('Local IP Address:', localIpAddress);

// Adjust maximum payload size
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/brands', express.static(path.join(__dirname, 'brands')));
app.use('/stores', express.static(path.join(__dirname, 'stores')));
app.use('/segment', express.static(path.join(__dirname, 'segment')));
app.use('/news', express.static(path.join(__dirname, 'news')));
app.use('/analytics', express.static(path.join(__dirname, 'analytics')));
app.use('/coupons', express.static(path.join(__dirname, 'coupons')));
app.use('/amazon', express.static(path.join(__dirname, 'amazon')));
app.use('/lego', express.static(path.join(__dirname, 'lego')));
app.use('/hm', express.static(path.join(__dirname, 'hm')));
app.use('/tommy', express.static(path.join(__dirname, 'tommy')));




// Enable CORS
app.use(cors());

// Use routes
app.use(authRoutes);
app.use(banner);
app.use(company);
app.use(store);
app.use(segment);
app.use(news);
app.use(analytics);
app.use(coupons);
app.use(amazon);
app.use(lego);
app.use(hm);
app.use(tommy);


// Example protected route
app.get('/', requireToken, (req, res) => {
    console.log(req.user);
    res.send(req.user);
});

app.get('/local-ip', (req, res) => {
    const localIp = getLocalIpAddress();
    console.log('Local IP Address:', localIp);
    res.json({ localIp });
  })

app.get('/search', async (req, res) => {
    const searchTerm = req.query.term;
    try {
      const [newsResponse, analyticsResponse, couponsResponse] = await Promise.all([
        axios.get(`http://localhost:3005/newone?title=${searchTerm}`),
        axios.get(`http://localhost:3005/analyticsone?title=${searchTerm}`),
        axios.get(`http://localhost:3005/couponsone?title=${searchTerm}`)
      ]);
  
      const combinedResults = [
        ...newsResponse.data.map(item => ({ ...item, category: 'news' })),
        ...analyticsResponse.data.map(item => ({ ...item, category: 'analytics' })),
        ...couponsResponse.data.map(item => ({ ...item, category: 'coupons' })),
      ];
  
      res.json(combinedResults);
    } catch (error) {
      console.error('Error fetching search results:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
