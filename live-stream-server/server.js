const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mediasoup = require('mediasoup');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:8000", "http://127.0.0.1:8000", "file://"],
        methods: ["GET", "POST"],
        transports: ['polling', 'websocket']
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

let worker;
let router;
let producerTransport;
let consumerTransports = new Map();
let producers = new Map();

async function createWorker() {
    worker = await mediasoup.createWorker({
        logLevel: 'warn',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMinPort: 10000,
        rtcMaxPort: 10100,
    });

    console.log('Mediasoup worker created');

    worker.on('died', () => {
        console.error('Mediasoup worker died, exiting...');
        process.exit(1);
    });

    return worker;
}

async function createRouter() {
    router = await worker.createRouter({
        mediaCodecs: [
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
        ],
    });

    console.log('Router created');
    return router;
}

io.on('connection', async (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('getRouterRtpCapabilities', (callback) => {
        callback(router.rtpCapabilities);
    });

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

    socket.on('connectProducerTransport', async ({ dtlsParameters }, callback) => {
        try {
            await producerTransport.connect({ dtlsParameters });
            callback();
        } catch (error) {
            console.error('Error connecting producer transport:', error);
            callback({ error: error.message });
        }
    });

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

    socket.on('consume', async ({ producerId }, callback) => {
        try {
            const transport = consumerTransports.get(socket.id);
            const producer = Array.from(producers.values()).find(p => p.id === producerId);

            if (!producer) {
                return callback({ error: 'Producer not found' });
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

    socket.on('getProducers', (callback) => {
        const producerList = Array.from(producers.values()).map(p => ({
            id: p.id,
            kind: p.kind
        }));
        callback(producerList);
    });

    socket.on('resumeConsumer', async ({ consumerId }, callback) => {
        try {
            const transport = consumerTransports.get(socket.id);
            const consumer = transport.consumers.find(c => c.id === consumerId);

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

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        const transport = consumerTransports.get(socket.id);
        if (transport) {
            transport.close();
            consumerTransports.delete(socket.id);
        }
        const producer = producers.get(socket.id);
        if (producer) {
            producer.close();
            producers.delete(socket.id);
        }
    });
});

async function startServer() {
    await createWorker();
    await createRouter();

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`Live streaming server running on port ${PORT}`);
    });
}

startServer().catch(console.error);
