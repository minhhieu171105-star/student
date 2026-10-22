const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { app, port } = require('./routes/studentRoutes');
const { client } = require('./config/db');

async function start() {
  await client.connect();
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
