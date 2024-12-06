const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3000;

const clientId = uuidv4();

const server = '192.168.4.1';

const commandServerUrl = `ws://${server}:69`;
const dataServerUrl = `ws://${server}:420`;

let commandSocket;
let dataSocket;

let sendingData = false;
let dataInterval;

function connectSockets() {
    commandSocket = new WebSocket(commandServerUrl);
    dataSocket = new WebSocket(dataServerUrl);

    commandSocket.on('open', () => {
        console.log('Connected to command server');
    });

    commandSocket.on('error', (err) => {
        console.error('Command server error:', err.message);
        reconnectCommandSocket();
    });

    dataSocket.on('open', () => {
        console.log('Connected to data server');
    });

    dataSocket.on('error', (err) => {
        console.error('Data server error:', err.message);
        reconnectDataSocket();
    });

    commandSocket.on('message', (message) => {
        const { clientId: messageClientId, command } = JSON.parse(message);
        if (command === 'on' && !sendingData && clientId == messageClientId) {
            sendingData = true;
            startSendingData();
        } else if (command === 'off' && sendingData && clientId == messageClientId) {
            sendingData = false;
            stopSendingData();
        }
    });
}

function reconnectCommandSocket() {
    setTimeout(() => {
        console.log('Attempting to reconnect to command server...');
        connectSockets();
    }, 5000); // Retry connection after 5 seconds
}

function reconnectDataSocket() {
    setTimeout(() => {
        console.log('Attempting to reconnect to data server...');
        connectSockets();
    }, 5000); // Retry connection after 5 seconds
}

function startSendingData() {
    dataInterval = setInterval(() => {
        const randomData = (Math.random() * 100).toFixed(2);
        dataSocket.send(JSON.stringify({ clientId, kWh: randomData }));
        commandSocket.send(JSON.stringify({ clientId, command: 'on' }));
    }, 1000); // Send data every second
}

function stopSendingData() {
    clearInterval(dataInterval);
    dataSocket.send(JSON.stringify({ clientId, message: 'stopped sending data' }));
    commandSocket.send(JSON.stringify({ clientId, command: 'off' }));
}

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/status', (req, res) => {
    res.json({ sendingData });
});

app.post('/toggle', (req, res) => {
    if (sendingData) {
        stopSendingData();
    } else {
        startSendingData();
    }
    res.json({ sendingData });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
    connectSockets(); // Start WebSocket connections when the server starts
});
