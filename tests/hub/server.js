const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const port = 3000;

// Create HTTP server for Express app
const server = http.createServer(app);

// WebSocket server for receiving data from clients and forwarding to another client
const dataForwarder = new WebSocket.Server({ noServer: true, port: 8083 }); // Use port 8083
const dataReceivers = [];

// WebSocket server for receiving commands from clients and forwarding to another server's clients
const commandForwarder = new WebSocket.Server({ noServer: true, port: 8084 }); // Use port 8084
const commandReceivers = [];

// WebSocket server for clients to connect and receive data
const dataServer = new WebSocket.Server({ server, port: 8081 }); // Use port 8081

// WebSocket server for clients to connect and send commands
const commandServer = new WebSocket.Server({ server, port: 8082 }); // Use port 8082

// Map to store client URLs
const clientUrls = new Map();

// Handle upgrade requests for data forwarding WebSocket server
server.on('upgrade', (request, socket, head) => {
  dataForwarder.handleUpgrade(request, socket, head, (ws) => {
    dataForwarder.emit('connection', ws, request);
  });
});

// Handle upgrade requests for command forwarding WebSocket server
server.on('upgrade', (request, socket, head) => {
  commandForwarder.handleUpgrade(request, socket, head, (ws) => {
    commandForwarder.emit('connection', ws, request);
  });
});

// Handle connection to data forwarding WebSocket server
dataForwarder.on('connection', (ws) => {
  dataReceivers.push(ws);

  ws.on('close', () => {
    dataReceivers.splice(dataReceivers.indexOf(ws), 1);
  });
});

// Handle connection to command forwarding WebSocket server
commandForwarder.on('connection', (ws) => {
  commandReceivers.push(ws);

  ws.on('close', () => {
    commandReceivers.splice(commandReceivers.indexOf(ws), 1);
  });
});

// Handle incoming data from clients and forward to other clients
dataServer.on('connection', (ws) => {
  ws.on('message', (message) => {
    dataReceivers.forEach(receiver => {
      if (receiver !== ws && receiver.readyState === WebSocket.OPEN) {
        receiver.send(message);
      }
    });
  });
});

// Handle incoming commands from clients and forward to other servers' clients
commandServer.on('connection', (ws) => {
  ws.on('message', (message) => {
    commandReceivers.forEach(receiver => {
      if (receiver.readyState === WebSocket.OPEN) {
        receiver.send(message);
      }
    });
  });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Route to handle client URLs
app.post('/client-url', (req, res) => {
  const { clientId, url } = req.body;
  clientUrls.set(clientId, url);
  res.sendStatus(200);
});

// Route to render the single page with iframes for client pages
app.get('/view-clients', (req, res) => {
  const iframes = [];
  clientUrls.forEach((url) => {
    iframes.push(`<iframe src="${url}" style="border: none; width: 50vw; height: 50vh;"></iframe>`);
  });
  res.send(`<html><head><title>View Clients</title></head><body>${iframes.join('')}</body></html>`);
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
