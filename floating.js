const { ipcRenderer } = require('electron');

const floatingTag = document.getElementById('floatingTag');
const floatingTime = document.getElementById('floatingTime');
const floatingScrollText = document.getElementById('floatingScrollText');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const stopBtn = document.getElementById('stopBtn');
const closeFloatingBtn = document.getElementById('closeFloatingBtn');
const notificationAudio = document.getElementById('notificationAudio');

let myTimer = null;

// Initialize timer
ipcRenderer.on('init-floating-timer', (event, timer) => {
  console.log('Floating timer init:', timer);
  myTimer = {
    id: timer.id,
    tag: timer.tag,
    endTime: timer.endTime,
    duration: timer.duration,
    status: 'running'
  };
  const displayText = timer.tag || 'Timer';
  floatingTag.textContent = displayText;
  floatingScrollText.textContent = displayText;

  // Apply gradient to drag handle
  if (timer.gradient) {
    document.querySelector('.floating-drag-handle').style.background = timer.gradient;
  }

  updateTime();
});

// Update from main process
ipcRenderer.on('timer-tick', (event, data) => {
  console.log('Floating timer tick:', data);
  if (myTimer && myTimer.id === data.id) {
    floatingTime.textContent = formatTime(data.remaining);
  }
});

ipcRenderer.on('timer-paused', (event, timerId) => {
  if (myTimer && myTimer.id === timerId) {
    myTimer.status = 'paused';
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'flex';
    floatingScrollText.className = 'floating-scroll-text paused';
  }
});

ipcRenderer.on('timer-resumed', (event, timerId) => {
  if (myTimer && myTimer.id === timerId) {
    myTimer.status = 'running';
    pauseBtn.style.display = 'flex';
    resumeBtn.style.display = 'none';
    floatingScrollText.className = 'floating-scroll-text';
  }
});

ipcRenderer.on('timer-complete', (event, data) => {
  if (myTimer && myTimer.id === (data.id || data)) {
    floatingScrollText.className = 'floating-scroll-text paused';
    if (data.showAnimation !== false) {
      showCompletionAnimation();
    } else {
      // Just grey out without animation
      const dragHandle = document.querySelector('.floating-drag-handle');
      dragHandle.style.background = 'linear-gradient(135deg, #666 0%, #444 100%)';
      floatingTime.style.color = '#666';
      floatingTag.style.color = '#666';
      document.querySelector('.floating-container').style.opacity = '0.7';

      // Show run again button
      showRunAgainButton();
    }
  }
});

ipcRenderer.on('timer-stopped', (event, timerId) => {
  if (myTimer && myTimer.id === timerId) {
    ipcRenderer.send('close-floating');
  }
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

// Button handlers
pauseBtn.addEventListener('click', () => {
  if (myTimer) ipcRenderer.send('pause-timer', myTimer.id);
});

resumeBtn.addEventListener('click', () => {
  if (myTimer) ipcRenderer.send('resume-timer', myTimer.id);
});

stopBtn.addEventListener('click', () => {
  if (myTimer) ipcRenderer.send('stop-timer', myTimer.id);
});

closeFloatingBtn.addEventListener('click', () => {
  ipcRenderer.send('close-floating');
});

// Format time function
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function updateTime() {
  if (myTimer && myTimer.endTime && myTimer.status === 'running') {
    const remaining = Math.max(0, Math.floor((myTimer.endTime - Date.now()) / 1000));
    console.log('Floating timer update:', remaining);
    floatingTime.textContent = formatTime(remaining);
  }
}

function showCompletionAnimation() {
  const dragHandle = document.querySelector('.floating-drag-handle');
  const container = document.querySelector('.floating-content');

  // Add red flash effect (4 quick flashes)
  let flashCount = 0;
  const flashInterval = setInterval(() => {
    if (flashCount % 2 === 0) {
      dragHandle.style.background = 'linear-gradient(135deg, #ff0000 0%, #ff4444 100%)';
      container.style.background = 'rgba(255, 0, 0, 0.3)';
    } else {
      dragHandle.style.background = 'linear-gradient(135deg, #8B0000 0%, #DC143C 100%)';
      container.style.background = 'transparent';
    }
    flashCount++;
    if (flashCount >= 8) {
      clearInterval(flashInterval);
      container.style.background = 'transparent';
      dragHandle.style.background = 'linear-gradient(135deg, #8B0000 0%, #DC143C 100%)';
    }
  }, 100);

  // Add completion overlay after flash
  setTimeout(() => {
    const overlay = document.createElement('div');
    overlay.className = 'completion-overlay';
    overlay.innerHTML = `
      <div class="completion-text">TIME'S UP!</div>
      <div class="completion-animation">✓</div>
      <div class="particles"></div>
    `;
    container.appendChild(overlay);

    // Create particles
    const particlesContainer = overlay.querySelector('.particles');
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 2 + 's';
      particlesContainer.appendChild(particle);
    }

    // Remove after 7 seconds and grey out
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      // Reset header color and grey out timer
      dragHandle.style.background = 'linear-gradient(135deg, #666 0%, #444 100%)';
      floatingTime.style.color = '#666';
      floatingTag.style.color = '#666';
      document.querySelector('.floating-container').style.opacity = '0.7';

      // Show run again button
      showRunAgainButton();
    }, 7000);
  }, 800);
}

function showRunAgainButton() {
  // Replace controls with run again button
  const controls = document.querySelector('.floating-controls');
  controls.innerHTML = `
    <button class="floating-btn run-again-btn" id="runAgainBtn" title="Run Again">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 5V19L19 12L8 5Z" fill="currentColor"/>
      </svg>
    </button>
    <button class="floating-btn" id="closeFloatingBtn2" title="Close">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
      </svg>
    </button>
  `;

  // Add event listeners
  document.getElementById('runAgainBtn').addEventListener('click', () => {
    if (myTimer) {
      // Reset window to normal state
      const dragHandle = document.querySelector('.floating-drag-handle');
      const container = document.querySelector('.floating-container');
      dragHandle.style.background = 'linear-gradient(135deg, #ff8c00 0%, #ff6600 100%)';
      floatingTime.style.color = '';
      floatingTag.style.color = '';
      container.style.opacity = '1';

      // Restore original controls
      const controls = document.querySelector('.floating-controls');
      controls.innerHTML = `
        <button class="floating-btn" id="pauseBtn" title="Pause">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 4H10V20H6V4ZM14 4H18V20H14V4Z" fill="currentColor"/>
          </svg>
        </button>
        <button class="floating-btn" id="resumeBtn" title="Play" style="display: none;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 5V19L19 12L8 5Z" fill="currentColor"/>
          </svg>
        </button>
        <button class="floating-btn" id="stopBtn" title="Stop">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="12" height="12" fill="currentColor"/>
          </svg>
        </button>
        <button class="floating-btn" id="closeFloatingBtn" title="Close">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
          </svg>
        </button>
      `;

      // Re-add event listeners
      addControlEventListeners();

      // Restart timer in same window
      const minutes = Math.floor(myTimer.duration / 60);
      const seconds = myTimer.duration % 60;
      let input = myTimer.tag ? `${myTimer.tag} ` : '';

      if (minutes > 0 && seconds > 0) {
        input += `${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        input += `${minutes}m`;
      } else {
        input += `${seconds}s`;
      }

      ipcRenderer.send('restart-timer-in-floating', input, myTimer.id);
    }
  });

  document.getElementById('closeFloatingBtn2').addEventListener('click', () => {
    ipcRenderer.send('close-floating');
  });
}

function addControlEventListeners() {
  const pauseBtn = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const stopBtn = document.getElementById('stopBtn');
  const closeBtn = document.getElementById('closeFloatingBtn');

  if (pauseBtn) pauseBtn.addEventListener('click', () => {
    if (myTimer) ipcRenderer.send('pause-timer', myTimer.id);
  });

  if (resumeBtn) resumeBtn.addEventListener('click', () => {
    if (myTimer) ipcRenderer.send('resume-timer', myTimer.id);
  });

  if (stopBtn) stopBtn.addEventListener('click', () => {
    if (myTimer) ipcRenderer.send('stop-timer', myTimer.id);
  });

  if (closeBtn) closeBtn.addEventListener('click', () => {
    ipcRenderer.send('close-floating');
  });
}

// Update time every second
setInterval(updateTime, 1000);