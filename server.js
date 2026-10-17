const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { app, port } = require('./routes/studentRoutes');
const { client } = require('./config/db');

client.connect()
  .then(() => app.listen(port, '127.0.0.1', () => {
    console.log('Student Node.js listening at http://127.0.0.1:' + port);
  }))
  .catch(error => {
    console.error('Student server startup failed:', error.message);
    process.exit(1);
  });
