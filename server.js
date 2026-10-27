const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { app, port } = require('./routes/studentRoutes');
const { client } = require('./config/db');

async function connectWithRetry() {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await client.connect();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 5) {
        const delay = attempt * 2000;
        console.error('MongoDB chưa sẵn sàng, thử lại sau ' + delay / 1000 + ' giây (' + attempt + '/5).');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function start() {
  await connectWithRetry();
    const server = app.listen(port, '0.0.0.0', () => {
      console.log('Student Node.js listening on http://localhost:' + port);
    });
    server.on('error', error => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Không thể khởi động Student: cổng ${port} đang được sử dụng. Dừng cửa sổ Node.js cũ hoặc đổi PORT trong .env.`);
      } else {
        console.error('Student HTTP server failed:', error.message);
      }
      process.exit(1);
    });
}

start().catch(error => {
  console.error('Student server startup failed:', error.message);
  process.exit(1);
});
