const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { app } = require('../routes/studentRoutes');

module.exports = app;
