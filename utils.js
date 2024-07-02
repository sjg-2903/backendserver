// utils.js

const { networkInterfaces } = require('os');

const getLocalIpAddress = () => {
  const nets = networkInterfaces();
  let ipAddress = '';

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Check for IPv4 address that is not internal (e.g., 127.0.0.1)
      if (net.family === 'IPv4' && !net.internal) {
        ipAddress = net.address;
        break;
      }
    }
  }

  return ipAddress;
};

module.exports = { getLocalIpAddress };
