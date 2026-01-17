const { ipcRenderer } = require('electron');

const timerInput = document.getElementById('timerInput');
const startBtn = document.getElementById('startBtn');
const closeBtn = document.getElementById('closeBtn');
const settingsBtn = document.getElementById('settingsBtn');
const timersList = document.getElementById('timersList');
const notificationAudio = document.getElementById('notificationAudio');
let timers = [];

function startTimer() {
  const input = timerInput.value.trim();
  if (!input) return;

  ipcRenderer.send('start-timer', input);
  timerInput.value = '';
}

startBtn.addEventListener('click', startTimer);

timerInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    startTimer();
  }
});

closeBtn.addEventListener('click', () => {
  ipcRenderer.send('close-window');
});

settingsBtn.addEventListener('click', () => {
  ipcRenderer.send('open-settings');
});

ipcRenderer.on('timer-started', (event, timer) => {
  timers.push(timer);
  renderTimers();
});

ipcRenderer.on('timer-tick', (event, data) => {
  const timer = timers.find(t => t.id === data.id);
  if (timer) {
    timer.remaining = data.remaining;
    renderTimers();
  }
});

ipcRenderer.on('timer-complete', (event, timerId) => {
  const timer = timers.find(t => t.id === timerId);
  if (timer) {
    timer.status = 'completed';
    timer.remaining = 0;
    renderTimers();
  }
});

ipcRenderer.on('timer-paused', (event, timerId) => {
  const timer = timers.find(t => t.id === timerId);
  if (timer) {
    timer.status = 'paused';
    renderTimers();
  }
});

ipcRenderer.on('timer-resumed', (event, timerId) => {
  const timer = timers.find(t => t.id === timerId);
  if (timer) {
    timer.status = 'running';
    renderTimers();
  }
});

ipcRenderer.on('timer-stopped', (event, timerId) => {
  const timer = timers.find(t => t.id === timerId);
  if (timer) {
    timer.status = 'stopped';
    timer.remaining = 0;
    renderTimers();
  }
});

ipcRenderer.on('timer-cleared', (event, timerId) => {
  timers = timers.filter(t => t.id !== timerId);
  renderTimers();
});

ipcRenderer.on('timer-error', (event, message) => {
  alert(message);
});

ipcRenderer.on('timers-list', (event, timersList) => {
  timers = timersList;
  renderTimers();
});

const path = require('path');

function playSound(soundName, volume) {
  // In production, unpacked files are in app.asar.unpacked folder
  let soundPath = path.join(__dirname, 'assets', 'sounds', `${soundName}.m4a`);

  // Check if we're in a packaged app (asar)
  if (__dirname.includes('app.asar')) {
    soundPath = soundPath.replace('app.asar', 'app.asar.unpacked');
  }

  const audio = new Audio(soundPath);
  audio.volume = volume;
  audio.play().catch(err => {
    console.error('Error playing sound:', err, 'Path:', soundPath);
    generateFallbackSound(volume);
  });
}

function generateFallbackSound(volume) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume * 0.3, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

  oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.5);

  oscillator.type = 'sine';
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
}

ipcRenderer.on('play-generated-sound', (event, data) => {
  playSound(data.soundName, data.volume);
});

function pauseTimer(timerId) {
  ipcRenderer.send('pause-timer', timerId);
}

function resumeTimer(timerId) {
  ipcRenderer.send('resume-timer', timerId);
}

function stopTimer(timerId) {
  ipcRenderer.send('stop-timer', timerId);
}

function clearTimer(timerId) {
  ipcRenderer.send('clear-timer', timerId);
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else if (minutes > 0) {
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  } else {
    return `${secs}s`;
  }
}

function renderTimers() {
  if (timers.length === 0) {
    timersList.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM12.5 7H11V13L16.25 16.15L17 14.92L12.5 12.25V7Z" fill="currentColor"/>
        </svg>
        <div>No active timers</div>
      </div>
    `;
    return;
  }

  // Sort timers: active first, then by most recent
  const sortedTimers = [...timers].sort((a, b) => {
    const aActive = a.status === 'running' || a.status === 'paused';
    const bActive = b.status === 'running' || b.status === 'paused';

    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    return b.id - a.id; // Most recent first
  });

  timersList.innerHTML = sortedTimers.map(timer => {
    const remaining = timer.remaining !== undefined ? timer.remaining : Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000));
    const isCompleted = timer.status === 'completed';
    const isStopped = timer.status === 'stopped';
    const isPaused = timer.status === 'paused';
    const isRunning = timer.status === 'running';
    const taskName = timer.tag || 'Timer';
    const timeDisplay = (isCompleted || isStopped) ? formatTime(timer.duration) : formatTime(remaining);

    return `
      <div class="timer-item ${isCompleted || isStopped ? 'completed' : ''}">
        <div class="timer-header" onclick="${isRunning || isPaused ? `showFloatingTimer(${timer.id})` : ''}" style="${isRunning || isPaused ? 'cursor: pointer;' : ''}">
          <div class="timer-tag ${timer.tag ? 'has-tag' : ''}">
            <span class="timer-status ${timer.status}"></span>
            ${taskName}
          </div>
          <div class="timer-time">${timeDisplay}</div>
        </div>
        <div class="timer-controls">
          ${isRunning ? `
            <button class="timer-btn pause" onclick="pauseTimer(${timer.id})">⏸ Pause</button>
          ` : ''}
          ${isPaused ? `
            <button class="timer-btn resume" onclick="resumeTimer(${timer.id})">▶ Resume</button>
          ` : ''}
          ${isRunning || isPaused ? `
            <button class="timer-btn stop" onclick="stopTimer(${timer.id})">⏹ Stop</button>
          ` : `
            <button class="timer-btn reuse" onclick="reuseTimer('${taskName}', ${timer.duration})">↻ Reuse</button>
            <button class="timer-btn stop" onclick="clearTimer(${timer.id})">✓ Clear</button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function reuseTimer(taskName, duration) {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  let input = taskName && taskName !== 'Timer' ? `${taskName} ` : '';

  if (minutes > 0 && seconds > 0) {
    input += `${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    input += `${minutes}m`;
  } else {
    input += `${seconds}s`;
  }

  ipcRenderer.send('start-timer', input);
}

function showFloatingTimer(timerId) {
  ipcRenderer.send('show-floating-timer', timerId);
}

function startPreset(preset) {
  ipcRenderer.send('start-timer', preset);
}

function updatePresets(presets) {
  const hintsContainer = document.querySelector('.hint-examples');
  hintsContainer.innerHTML = presets.map(preset =>
    `<span class="hint-example" onclick="startPreset('${preset.time}')">${preset.display || preset.name}</span>`
  ).join('');
}

ipcRenderer.on('presets-updated', (event, presets) => {
  updatePresets(presets);
});

// Load initial presets
ipcRenderer.send('get-presets');
ipcRenderer.on('presets-data', (event, presets) => {
  updatePresets(presets);
});

window.pauseTimer = pauseTimer;
window.resumeTimer = resumeTimer;
window.stopTimer = stopTimer;
window.clearTimer = clearTimer;
window.reuseTimer = reuseTimer;
window.startPreset = startPreset;
window.showFloatingTimer = showFloatingTimer;

ipcRenderer.send('get-timers');

setInterval(() => {
  renderTimers();
}, 1000);

