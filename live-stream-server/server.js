const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mediasoup = require('mediasoup');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static('public'));

// Global variables
let worker;
let router;
let producerTransport;
let consumerTransports = new Map();
let producers = new Map();
let rooms = new Map(); // Room-based broadcasting

const mediaCodecs = [
    {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
    },
    {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
            'x-google-start-bitrate': 1000,
        },
    },
];

async function createWorker() {
    worker = await mediasoup.createWorker({
        logLevel: 'warn',
        rtcMinPort: 20000,
        rtcMaxPort: 20200,
    });

    console.log('Worker created, PID:', worker.pid);

    worker.on('died', () => {
        console.error('Mediasoup worker died');
        setTimeout(() => process.exit(1), 2000);
    });

    return worker;
}

async function createRouter() {
    router = await worker.createRouter({ mediaCodecs });
    console.log('Router created');
    return router;
}

async function init() {
    try {
        await createWorker();
        await createRouter();
        console.log('Mediasoup initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Mediasoup:', error);
        process.exit(1);
    }
}

init();

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Clean up consumer transports
        if (consumerTransports.has(socket.id)) {
            consumerTransports.get(socket.id).close();
            consumerTransports.delete(socket.id);
        }
    });

    // Get router RTP capabilities
    socket.on('getRouterRtpCapabilities', (callback) => {
        callback(router.rtpCapabilities);
    });

    // Create producer transport
    socket.on('createProducerTransport', async (callback) => {
        try {
            const transport = await router.createWebRtcTransport({
                listenIps: [{ ip: '0.0.0.0', announcedIp: null }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });

            producerTransport = transport;

            transport.on('dtlsstatechange', (dtlsState) => {
                if (dtlsState === 'closed') {
                    transport.close();
                }
            });

            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        } catch (error) {
            console.error('Error creating producer transport:', error);
            callback({ error: error.message });
        }
    });

    // Connect producer transport
    socket.on('connectProducerTransport', async ({ dtlsParameters }, callback) => {
        try {
            await producerTransport.connect({ dtlsParameters });
            callback();
        } catch (error) {
            console.error('Error connecting producer transport:', error);
            callback({ error: error.message });
        }
    });

    // Produce media
    socket.on('produce', async ({ kind, rtpParameters }, callback) => {
        try {
            const producer = await producerTransport.produce({ kind, rtpParameters });
            producers.set(socket.id, producer);

            producer.on('transportclose', () => {
                console.log('Producer transport closed');
                producer.close();
                producers.delete(socket.id);
            });

            callback({ id: producer.id });
        } catch (error) {
            console.error('Error producing:', error);
            callback({ error: error.message });
        }
    });

    // Create consumer transport
    socket.on('createConsumerTransport', async (callback) => {
        try {
            const transport = await router.createWebRtcTransport({
                listenIps: [{ ip: '0.0.0.0', announcedIp: null }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });

            consumerTransports.set(socket.id, transport);

            transport.on('dtlsstatechange', (dtlsState) => {
                if (dtlsState === 'closed') {
                    transport.close();
                    consumerTransports.delete(socket.id);
                }
            });

            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        } catch (error) {
            console.error('Error creating consumer transport:', error);
            callback({ error: error.message });
        }
    });

    // Connect consumer transport
    socket.on('connectConsumerTransport', async ({ dtlsParameters }, callback) => {
        try {
            const transport = consumerTransports.get(socket.id);
            await transport.connect({ dtlsParameters });
            callback();
        } catch (error) {
            console.error('Error connecting consumer transport:', error);
            callback({ error: error.message });
        }
    });

    // Consume media
    socket.on('consume', async ({ producerId }, callback) => {
        try {
            const transport = consumerTransports.get(socket.id);
            const producer = Array.from(producers.values()).find(p => p.id === producerId);

            if (!producer) {
                callback({ error: 'Producer not found' });
                return;
            }

            const consumer = await transport.consume({
                producerId: producer.id,
                rtpCapabilities: router.rtpCapabilities,
                paused: true,
            });

            consumer.on('transportclose', () => {
                console.log('Consumer transport closed');
            });

            consumer.on('producerclose', () => {
                console.log('Producer closed');
                consumer.close();
            });

            callback({
                id: consumer.id,
                producerId: producer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            });
        } catch (error) {
            console.error('Error consuming:', error);
            callback({ error: error.message });
        }
    });

    // Resume consumer
    socket.on('resumeConsumer', async ({ consumerId }, callback) => {
        try {
            const transport = consumerTransports.get(socket.id);
            const consumer = transport._getConsumer(consumerId);

            if (consumer) {
                await consumer.resume();
                callback();
            } else {
                callback({ error: 'Consumer not found' });
            }
        } catch (error) {
            console.error('Error resuming consumer:', error);
            callback({ error: error.message });
        }
    });

    // Get available producers
    socket.on('getProducers', (callback) => {
        const producerList = Array.from(producers.values()).map(producer => ({
            id: producer.id,
            kind: producer.kind,
        }));
        callback(producerList);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Live stream server running on port ${PORT}`);
});
