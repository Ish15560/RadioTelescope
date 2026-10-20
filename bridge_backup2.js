const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4000;
const WS_PORT = 8765;
const SERIAL_PORT = 'COM4';
const BAUD_RATE = 115200;

const dashDir = path.join(__dirname, 'Dashboard');
fs.mkdirSync(dashDir, { recursive: true });
const csvPath = path.join(dashDir, 'telemetry.csv');
const csvStream = fs.createWriteStream(csvPath, { flags: 'a' });

let currentMode = 'simulation'; // 'esp32' | 'simulation'
let simStep = 0;
let isBurstActive = false;

function gaussianRandom(mean = 0, stdev = 1) {
    let u = 1 - Math.random(), v = 1 - Math.random();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdev + mean;
}

const server = http.createServer((req, res) => {
    let cleanUrl = req.url.split('?')[0];
    let subPath = cleanUrl === '/' ? '/dashboard.html' : cleanUrl;
    let targetFile = subPath.startsWith('/Dashboard') ? subPath : '/Dashboard' + subPath;
    let filePath = path.join(__dirname, targetFile);

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found: ' + req.url);
        } else {
            const ext = path.extname(filePath);
            const map = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.csv': 'text/csv' };
            res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
            res.end(content);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Dashboard LIVE at: http://localhost:${PORT}/dashboard.html`);
});

const wss = new WebSocketServer({ port: WS_PORT });
let clients = new Set();

function broadcast(payloadObj) {
    const payload = JSON.stringify(payloadObj);
    for (const c of clients) {
        if (c.readyState === 1) c.send(payload);
    }
}

wss.on('connection', ws => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'control', status: 'connected', mode: currentMode }));

    ws.on('message', msg => {
        try {
            const parsed = JSON.parse(msg.toString());
            if (parsed.action === 'setMode') {
                currentMode = parsed.mode;
                console.log(`[Bridge] Mode switched to: ${currentMode.toUpperCase()}`);
                broadcast({ type: 'control', status: 'modeChanged', mode: currentMode });
            } else if (parsed.action === 'solarBurst') {
                console.log('[Bridge] Solar burst injected');
                isBurstActive = true;
                setTimeout(() => { isBurstActive = false; }, 6000);
            }
        } catch (e) {}
    });

    ws.onclose = () => clients.delete(ws);
});
console.log(`✅ WebSocket bridge active on ws://localhost:${WS_PORT}`);

// Simulation Loop (ONLY runs when currentMode === 'simulation')
setInterval(() => {
    if (currentMode === 'simulation') {
        simStep += 0.15;
        const skyBase = 110.0;
        const transitPeak = 55.0 * Math.exp(-Math.pow((simStep % 35) - 17.5, 2) / 25.0);
        const burstAdd = isBurstActive ? 350.0 : 0.0;
        const totalPower = parseFloat((skyBase + transitPeak + burstAdd + gaussianRandom(0, 1.5)).toFixed(2));

        const timestamp = new Date().toISOString();
        try { csvStream.write(`${timestamp},SIM,${totalPower}\n`); } catch(e){}

        const spectrumBins = [];
        for (let i = 0; i < 16; i++) {
            const centerBell = Math.exp(-Math.pow(i - 7.5, 2) / 18.0);
            const val = totalPower * 0.08 * (0.8 + 0.4 * centerBell) + gaussianRandom(0, 0.4);
            spectrumBins.push(parseFloat(val.toFixed(2)));
        }

        broadcast({
            source: 'simulation',
            timestamp: timestamp,
            totalPower: totalPower,
            spectrum: spectrumBins,
            raw: totalPower.toString()
        });
    }
}, 1000);

// Serial Port Ingestion (ONLY processes when currentMode === 'esp32')
try {
    const port = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE, autoOpen: false });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
    
    port.open((err) => {
        if (err) console.warn(`⚠️ COM note (${SERIAL_PORT}):`, err.message);
        else console.log(`✅ Connected to hardware serial on ${SERIAL_PORT} @ ${BAUD_RATE}`);
    });

    parser.on('data', d => {
        if (currentMode === 'esp32') {
            const rawLine = d.trim();
            const timestamp = new Date().toISOString();
            
            let valNum = NaN;
            let customBins = null;
            let peakVal = null;

            try {
                const parsedJson = JSON.parse(rawLine);
                if (parsedJson.totalPower !== undefined) valNum = parseFloat(parsedJson.totalPower);
                else if (parsedJson.power !== undefined) valNum = parseFloat(parsedJson.power);
                if (Array.isArray(parsedJson.spectrum)) customBins = parsedJson.spectrum;
                if (parsedJson.peak !== undefined) peakVal = parseFloat(parsedJson.peak);
            } catch (e) {
                valNum = parseFloat(rawLine);
            }

            if (!isNaN(valNum)) {
                // Out-of-bounds rejection gate for floating ADC / noise spikes
                const MIN_VALID_SFU = -20.0;
                const MAX_VALID_SFU = 1500.0;
                if (valNum < MIN_VALID_SFU || valNum > MAX_VALID_SFU) {
                    console.warn(`[Bridge] Rejected out-of-bounds ESP32 spike: ${valNum} SFU`);
                    return;
                }

                try { csvStream.write(`${timestamp},ESP32,${valNum}\n`); } catch(e){}

                const spectrumBins = customBins || Array.from({length: 16}, (_, i) => {
                    return parseFloat((valNum * 0.06 * (0.9 + 0.1 * Math.sin(i * 0.5)) + gaussianRandom(0, 0.2)).toFixed(2));
                });

                broadcast({
                    source: 'esp32',
                    timestamp: timestamp,
                    totalPower: parseFloat(valNum.toFixed(2)),
                    spectrum: spectrumBins,
                    peak: peakVal,
                    raw: rawLine
                });
            }
        }
    });
} catch(e) {
    console.warn('Serial init error:', e.message);
}