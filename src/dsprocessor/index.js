"use strict";
const net = require('net');

const server = net.createServer((c) => {
  // 'connection' listener
  console.log('client connected');
  c.on('end', () => {
    console.log('client disconnected');
  });
  c.write('hello\r\n'); //write processed epochs
  c.pipe(c);
});

server.on('error', (err) => {
  throw err;
});

server.listen(2048, () => {
  console.log('server bound');
});
