const WS_URL = 'ws://localhost:8765';
let ws = null;
let stripChart, specChart;

const MAX_POINTS = 40;
const timeLabels = [];
const rawPowerBuffer = [];
const filteredPowerBuffer = [];

let peakVal = 0;
let packetCount = 0;

const metricPower = document.getElementById('metricPower');
const statPeak = document.getElementById('statPeak');
const statRms = document.getElementById('statRms');
const linkStatus = document.getElementById('linkStatus');
const rawLog = document.getElementById('rawLog');
const filterWindow = document.getElementById('filterWindow');
const winLabel = document.getElementById('winLabel');
const baselineOffset = document.getElementById('baselineOffset');
const offsetLabel = document.getElementById('offsetLabel');
const modeSelect = document.getElementById('modeSelect');

function logTerminal(txt) {
  const t = new Date().toTimeString().split(' ')[0];
  rawLog.insertAdjacentHTML('beforeend', `<div>[${t}] ${txt}</div>`);
  if (rawLog.childElementCount > 50) rawLog.removeChild(rawLog.firstElementChild);
  rawLog.scrollTop = rawLog.scrollHeight;
}

function initCharts() {
  const ctxStrip = document.getElementById('stripChart').getContext('2d');
  stripChart = new Chart(ctxStrip, {
    type: 'line',
    data: {
      labels: timeLabels,
      datasets: [
        { label: 'Filtered Power (SFU)', data: filteredPowerBuffer, borderColor: '#38bdf8', borderWidth: 1.8, pointRadius: 1, fill: true, backgroundColor: 'rgba(56, 189, 248, 0.06)' },
        { label: 'Raw Sample', data: rawPowerBuffer, borderColor: 'rgba(156, 163, 175, 0.25)', borderWidth: 1, borderDash: [2,2], pointRadius: 0 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      scales: {
        x: { ticks: { color: '#9ca3af', font: { size: 9, family: 'JetBrains Mono' } }, grid: { color: 'rgba(255,255,255,0.03)' } },
        y: { ticks: { color: '#9ca3af', font: { size: 9, family: 'JetBrains Mono' } }, grid: { color: 'rgba(255,255,255,0.03)' } }
      },
      plugins: { legend: { labels: { color: '#9ca3af', font: { size: 10, family: 'JetBrains Mono' } } } }
    }
  });

  const ctxSpec = document.getElementById('specChart').getContext('2d');
  specChart = new Chart(ctxSpec, {
    type: 'bar',
    data: {
      labels: Array.from({length:16}, (_,i) => `CH${i+1}`),
      datasets: [{ label: 'Channel Power', data: Array(16).fill(0), backgroundColor: 'rgba(56, 189, 248, 0.4)', borderColor: '#38bdf8', borderWidth: 1 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      scales: {
        x: { ticks: { color: '#9ca3af', font: { size: 8, family: 'JetBrains Mono' } }, grid: { display: false } },
        y: { ticks: { color: '#9ca3af', font: { size: 8, family: 'JetBrains Mono' } }, grid: { color: 'rgba(255,255,255,0.03)' } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function computeRms(arr) {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
  const variance = arr.reduce((a,b)=>a+Math.pow(b-mean,2),0)/arr.length;
  return Math.sqrt(variance);
}

function processFrame(dataObj) {
  const offset = parseFloat(baselineOffset.value) || 0;
  const winSize = parseInt(filterWindow.value) || 8;
  const rawNum = parseFloat(dataObj.totalPower) || 0;
  const adjusted = rawNum + offset;

  const nowStr = new Date().toTimeString().split(' ')[0];
  if (timeLabels.length >= MAX_POINTS) {
    timeLabels.shift();
    rawPowerBuffer.shift();
    filteredPowerBuffer.shift();
  }

  timeLabels.push(nowStr);
  rawPowerBuffer.push(adjusted);

  const windowSlice = rawPowerBuffer.slice(-Math.min(rawPowerBuffer.length, winSize));
  const smoothVal = windowSlice.reduce((a,b)=>a+b,0) / windowSlice.length;
  filteredPowerBuffer.push(smoothVal);

  packetCount++;
  if (smoothVal > peakVal) peakVal = smoothVal;
  // Account for hardware-reported peak if higher
  if (dataObj.peak && parseFloat(dataObj.peak) > peakVal) {
    peakVal = parseFloat(dataObj.peak);
  }

  metricPower.textContent = smoothVal.toFixed(2);
  statPeak.textContent = peakVal.toFixed(2);
  statRms.textContent = computeRms(filteredPowerBuffer).toFixed(3);

  if (dataObj.spectrum && Array.isArray(dataObj.spectrum)) {
    specChart.data.datasets[0].data = dataObj.spectrum;
    specChart.update('none');
  }

  stripChart.update('none');
}

function connectWS() {
  linkStatus.textContent = 'CONNECTING...';
  linkStatus.style.color = '#f59e0b';
  ws = new WebSocket(WS_URL);
  
  ws.onopen = () => {
    linkStatus.textContent = 'ONLINE';
    linkStatus.style.color = '#10b981';
    logTerminal('WebSocket connected to port 8765.');
  };
  
  ws.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      if (parsed.totalPower !== undefined) {
        logTerminal(`[${(parsed.source||'esp32').toUpperCase()}] Power=${parsed.totalPower}`);
        processFrame(parsed);
      } else {
        logTerminal(`[WS CTRL] ${event.data}`);
      }
    } catch(e) {
      logTerminal(`[PARSE ERR] ${event.data}`);
    }
  };

  ws.onerror = (err) => {
    logTerminal(`[WS ERR] Connection fault`);
  };

  ws.onclose = () => {
    linkStatus.textContent = 'OFFLINE';
    linkStatus.style.color = '#ef4444';
    logTerminal('WS dropped. Retrying in 3s...');
    setTimeout(connectWS, 3000);
  };
}

filterWindow.addEventListener('input', () => winLabel.textContent = filterWindow.value + ' pts');
baselineOffset.addEventListener('input', () => offsetLabel.textContent = parseFloat(baselineOffset.value).toFixed(1));

modeSelect.addEventListener('change', (e) => {
  const mode = e.target.value;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action: 'setMode', mode }));
  }
  logTerminal(`Switched mode request -> ${mode.toUpperCase()}`);
});

document.getElementById('btnBurst')?.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action: 'solarBurst' }));
  }
  logTerminal('[INJECT] Solar radio burst triggered.');
});

document.getElementById('btnExport')?.addEventListener('click', () => {
  const rows = [['Timestamp', 'Raw_Value', 'Filtered_Value']];
  timeLabels.forEach((t, i) => rows.push([t, rawPowerBuffer[i], filteredPowerBuffer[i]]));
  const blob = new Blob([rows.map(r=>r.join(',')).join('\n')], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `radio_telescope_session_${Date.now()}.csv`;
  a.click();
  logTerminal('[EXPORT] CSV telemetry dump generated.');
});

window.addEventListener('DOMContentLoaded', () => {
  initCharts();
  connectWS();
});