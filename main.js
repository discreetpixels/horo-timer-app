const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;
let mainWindow = null;
let floatingWindows = new Map();
let settingsWindow = null;
let timers = [];
let timerIdCounter = 1;
let settings = {
  notificationSound: 'Lexie-Orbit',
  showNotification: true,
  playSound: true,
  startAtLogin: false,
  volume: 50,
  showCompletionAnimation: true,
  customPresets: [
    { name: 'Focus', time: 'Focus 25m', display: '25 min Focus' },
    { name: 'Working', time: 'Working 30m', display: '30 min Working' },
    { name: 'Meeting', time: 'Meeting 30m', display: '30 min Meeting' },
    { name: 'Meeting', time: 'Meeting 1h', display: '1h Meeting' },
    { name: 'Admin work', time: 'Admin work 30m', display: '30 min Admin work' },
    { name: 'Break', time: 'Break 5m', display: '5 min Break' }
  ]
};

let SETTINGS_PATH;
let TIMERS_PATH;

// Load settings
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
      settings = { ...settings, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings
function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Load timers
function loadTimers() {
  try {
    if (fs.existsSync(TIMERS_PATH)) {
      const data = fs.readFileSync(TIMERS_PATH, 'utf8');
      const savedTimers = JSON.parse(data);
      timers = savedTimers.filter(t => t.status === 'completed' || t.status === 'stopped').slice(0, 20);
    }
  } catch (error) {
    console.error('Error loading timers:', error);
  }
}

// Save timers
function saveTimers() {
  try {
    const timersToSave = timers.filter(t => t.status === 'completed' || t.status === 'stopped').slice(0, 20);
    fs.writeFileSync(TIMERS_PATH, JSON.stringify(timersToSave, null, 2));
  } catch (error) {
    console.error('Error saving timers:', error);
  }
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon3.png');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  
  tray.setToolTip('Ruby10');
  
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        showWindow();
      }
    } else {
      createWindow();
      setTimeout(() => {
        mainWindow.webContents.executeJavaScript('document.getElementById("timerInput").focus();');
      }, 100);
    }
  });
  
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        showWindow();
      }
    } else {
      createWindow();
      setTimeout(() => {
        mainWindow.webContents.executeJavaScript('document.getElementById("timerInput").focus();');
      }, 100);
    }
  });
  
  tray.on('right-click', () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Ruby10',
        click: () => {
          if (!mainWindow) createWindow();
          showWindow();
        }
      },
      {
        label: 'Settings',
        click: () => {
          createSettingsWindow();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        }
      }
    ]);
    tray.popUpContextMenu(contextMenu);
  });
  
  updateTrayTitle();
}

function showWindow() {
  if (!mainWindow) {
    createWindow();
  }
  
  const trayBounds = tray.getBounds();
  const windowBounds = mainWindow.getBounds();
  
  const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
  const y = Math.round(trayBounds.y + trayBounds.height + 4);
  
  mainWindow.setPosition(x, y, false);
  mainWindow.show();
  mainWindow.focus();
  
  // Auto-focus input field
  mainWindow.webContents.executeJavaScript('document.getElementById("timerInput").focus();');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 550,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('blur', () => {
    if (!mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createFloatingWindow(timer) {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  
  const existingWindows = Array.from(floatingWindows.values());
  const yOffset = existingWindows.length * 130;

  const floatingWindow = new BrowserWindow({
    width: 280,
    height: 110,
    x: width - 300,
    y: 20 + yOffset,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  floatingWindow.loadFile('floating.html');
  
  floatingWindow.once('ready-to-show', () => {
    floatingWindow.webContents.send('init-floating-timer', {
      id: timer.id,
      tag: timer.tag,
      endTime: timer.endTime,
      duration: timer.duration,
      status: timer.status,
      gradient: timer.gradient
    });
  });

  floatingWindow.on('closed', () => {
    floatingWindows.delete(timer.id);
  });
  
  floatingWindows.set(timer.id, floatingWindow);
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 800,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  settingsWindow.loadFile('settings.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function updateTrayTitle() {
  if (!tray) return;
  
  const activeTimers = timers.filter(t => t.status === 'running');
  
  if (activeTimers.length > 0) {
    const nextTimer = activeTimers.reduce((min, timer) => {
      const remaining = timer.endTime - Date.now();
      const minRemaining = min.endTime - Date.now();
      return remaining < minRemaining ? timer : min;
    });
    
    const remaining = Math.max(0, Math.floor((nextTimer.endTime - Date.now()) / 1000));
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    
    let timeStr = '';
    if (hours > 0) {
      timeStr = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else if (minutes > 0) {
      timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
    } else {
      timeStr = `0:${String(seconds).padStart(2, '0')}`;
    }
    
    tray.setTitle(` ${timeStr}`);
  } else {
    tray.setTitle('');
  }
}

function parseTimeInput(input) {
  input = input.trim();
  
  if (input.startsWith('@')) {
    const timeStr = input.substring(1).toLowerCase();
    const now = new Date();
    let targetTime = new Date();
    
    const pmMatch = timeStr.match(/^(\d{1,2})(am|pm)$/);
    const colonMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    
    if (pmMatch) {
      let hours = parseInt(pmMatch[1]);
      const isPM = pmMatch[2] === 'pm';
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      targetTime.setHours(hours, 0, 0, 0);
    } else if (colonMatch) {
      targetTime.setHours(parseInt(colonMatch[1]), parseInt(colonMatch[2]), 0, 0);
    } else {
      return null;
    }
    
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    return Math.floor((targetTime - now) / 1000);
  }
  
  // Extract task name and time
  let taskName = '';
  let timeInput = input.toLowerCase();
  
  // Look for time patterns at the end
  const timePattern = /(\d+(?:\.\d+)?\s*(?:h|m|s|min|mins|hour|hours|second|seconds))\s*$/i;
  const timeMatch = input.match(timePattern);
  
  if (timeMatch) {
    taskName = input.substring(0, timeMatch.index).trim();
    timeInput = timeMatch[1].toLowerCase();
  } else {
    // If no time pattern found, check if it's just a number (assume minutes)
    const numOnlyMatch = input.match(/^(.*)\s+(\d+(?:\.\d+)?)\s*$/);
    if (numOnlyMatch) {
      taskName = numOnlyMatch[1].trim();
      timeInput = numOnlyMatch[2];
    }
  }
  
  let totalSeconds = 0;
  
  const hourMatch = timeInput.match(/(\d+(?:\.\d+)?)\s*h/);
  const minMatch = timeInput.match(/(\d+(?:\.\d+)?)\s*m(?!s)/);
  const secMatch = timeInput.match(/(\d+(?:\.\d+)?)\s*s/);
  
  if (hourMatch) {
    totalSeconds += parseFloat(hourMatch[1]) * 3600;
  }
  if (minMatch) {
    totalSeconds += parseFloat(minMatch[1]) * 60;
  }
  if (secMatch) {
    totalSeconds += parseFloat(secMatch[1]);
  }
  
  if (totalSeconds === 0) {
    const numMatch = timeInput.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      totalSeconds = parseFloat(numMatch[1]) * 60;
    }
  }
  
  return totalSeconds > 0 ? { seconds: totalSeconds, tag: taskName } : null;
}

function playNotificationSound() {
  if (!settings.playSound) return;
  
  const volume = (settings.volume || 50) / 100;
  
  if (mainWindow) {
    mainWindow.webContents.send('play-generated-sound', { soundName: settings.notificationSound, volume: volume });
  }
  floatingWindows.forEach(window => {
    window.webContents.send('play-generated-sound', { soundName: settings.notificationSound, volume: volume });
  });
}

ipcMain.on('start-timer', (event, input, skipFloating = false) => {
  const parsed = parseTimeInput(input);
  
  if (!parsed) {
    event.reply('timer-error', 'Invalid time format');
    return;
  }
  
  const seconds = typeof parsed === 'number' ? parsed : parsed.seconds;
  const tag = typeof parsed === 'object' ? parsed.tag : '';
  
  const gradients = [
    'linear-gradient(135deg, #ff8c00 0%, #ff6600 100%)', // Orange (original)
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Purple-Blue
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // Pink-Red
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Blue-Cyan
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', // Green-Teal
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // Pink-Yellow
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', // Mint-Pink
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', // Coral-Pink
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', // Peach
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)'  // Lavender-Pink
  ];
  
  const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];
  
  const timer = {
    id: timerIdCounter++,
    type: 'timer',
    duration: seconds,
    endTime: Date.now() + (seconds * 1000),
    status: 'running',
    tag: tag,
    startTime: Date.now(),
    interval: null,
    gradient: randomGradient,
  };
  
  timers.push(timer);
  event.reply('timer-started', timer);
  
  // Create floating window for each timer (unless restarting from existing)
  if (!skipFloating) {
    createFloatingWindow(timer);
  }
  
  timer.interval = setInterval(() => {
    const remaining = Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000));
    
    if (remaining === 0) {
      clearInterval(timer.interval);
      timer.status = 'completed';
      
      // Keep completed timers in main list for history
      // Limit total timers to 20
      if (timers.length > 20) {
        timers = timers.slice(0, 20);
      }
      
      saveTimers();
      
      // Only play sound and show notification for natural completion
      playNotificationSound();
      
      if (settings.showNotification) {
        const notification = new Notification({
          title: 'Timer Complete!',
          body: tag ? `Timer for #${tag} has finished` : 'Your timer has finished',
          silent: !settings.playSound,
        });
        notification.show();
      }
      
      // Broadcast to all windows
      if (mainWindow) {
        mainWindow.webContents.send('timer-complete', timer.id);
      }
      floatingWindows.forEach(window => {
        window.webContents.send('timer-complete', timer.id);
      });
      
      updateTrayTitle();
    } else {
      if (mainWindow) {
        mainWindow.webContents.send('timer-tick', { id: timer.id, remaining });
      }
      if (floatingWindows.has(timer.id)) {
        floatingWindows.get(timer.id).webContents.send('timer-tick', { id: timer.id, remaining });
      }
      updateTrayTitle();
    }
  }, 1000);
});

ipcMain.on('pause-timer', (event, timerId) => {
  const timer = timers.find(t => t.id === timerId);
  if (timer && timer.status === 'running') {
    clearInterval(timer.interval);
    timer.status = 'paused';
    timer.remainingTime = Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000));
    
    // Broadcast to all windows
    if (mainWindow) mainWindow.webContents.send('timer-paused', timerId);
    if (floatingWindows.has(timerId)) {
      floatingWindows.get(timerId).webContents.send('timer-paused', timerId);
    }
    updateTrayTitle();
  }
});

ipcMain.on('resume-timer', (event, timerId) => {
  const timer = timers.find(t => t.id === timerId);
  if (timer && timer.status === 'paused') {
    timer.status = 'running';
    timer.endTime = Date.now() + (timer.remainingTime * 1000);
    
    // Restart the interval
    timer.interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000));
      
      if (remaining === 0) {
        clearInterval(timer.interval);
        timer.status = 'completed';
        
        if (timers.length > 20) {
          timers = timers.slice(0, 20);
        }
        
        playNotificationSound();
        
        if (settings.showNotification) {
          const notification = new Notification({
            title: 'Timer Complete!',
            body: timer.tag ? `Timer for #${timer.tag} has finished` : 'Your timer has finished',
            silent: !settings.playSound,
          });
          notification.show();
        }
        
        if (mainWindow) {
          mainWindow.webContents.send('timer-complete', timer.id);
        }
        if (floatingWindows.has(timer.id)) {
          floatingWindows.get(timer.id).webContents.send('timer-complete', {
            id: timer.id,
            showAnimation: settings.showCompletionAnimation
          });
        }
        
        updateTrayTitle();
      } else {
        if (mainWindow) {
          mainWindow.webContents.send('timer-tick', { id: timer.id, remaining });
        }
        if (floatingWindows.has(timer.id)) {
          floatingWindows.get(timer.id).webContents.send('timer-tick', { id: timer.id, remaining });
        }
        updateTrayTitle();
      }
    }, 1000);
    
    // Broadcast to all windows
    if (mainWindow) mainWindow.webContents.send('timer-resumed', timerId);
    if (floatingWindows.has(timerId)) {
      floatingWindows.get(timerId).webContents.send('timer-resumed', timerId);
    }
    updateTrayTitle();
  }
});

ipcMain.on('stop-timer', (event, timerId) => {
  const timer = timers.find(t => t.id === timerId);
  if (timer) {
    // Clear the interval if it exists
    if (timer.interval) {
      clearInterval(timer.interval);
      timer.interval = null;
    }
    
    timer.status = 'stopped';
    timer.remaining = 0;
    timer.endTime = Date.now();
    
    // Broadcast to all windows (no sound for manual stop)
    if (mainWindow) mainWindow.webContents.send('timer-stopped', timerId);
    if (floatingWindows.has(timerId)) {
      floatingWindows.get(timerId).webContents.send('timer-stopped', timerId);
      floatingWindows.get(timerId).hide();
    }
    updateTrayTitle();
  }
});

ipcMain.on('get-timers', (event) => {
  event.reply('timers-list', timers);
});

ipcMain.on('clear-timer', (event, timerId) => {
  const index = timers.findIndex(t => t.id === timerId);
  if (index !== -1) {
    timers.splice(index, 1);
    if (mainWindow) mainWindow.webContents.send('timer-cleared', timerId);
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

ipcMain.on('get-settings', (event) => {
  event.reply('settings-data', settings);
});

ipcMain.on('save-settings', (event, newSettings) => {
  settings = { ...settings, ...newSettings };
  saveSettings();
  event.reply('settings-saved');
});

ipcMain.on('get-presets', (event) => {
  event.reply('presets-data', settings.customPresets);
});

ipcMain.on('save-presets', (event, presets) => {
  settings.customPresets = presets;
  saveSettings();
  if (mainWindow) {
    mainWindow.webContents.send('presets-updated', presets);
  }
});

ipcMain.on('close-floating', (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow) {
    senderWindow.hide();
  }
});

ipcMain.on('show-floating-timer', (event, timerId) => {
  const floatingWindow = floatingWindows.get(timerId);
  if (floatingWindow) {
    floatingWindow.show();
    floatingWindow.focus();
  }
});

ipcMain.on('restart-timer-in-floating', (event, input, oldTimerId) => {
  // Remove old timer
  const oldIndex = timers.findIndex(t => t.id === oldTimerId);
  if (oldIndex !== -1) {
    timers.splice(oldIndex, 1);
  }
  
  // Start new timer without creating new floating window
  const parsed = parseTimeInput(input);
  if (!parsed) {
    event.reply('timer-error', 'Invalid time format');
    return;
  }
  
  const seconds = typeof parsed === 'number' ? parsed : parsed.seconds;
  const tag = typeof parsed === 'object' ? parsed.tag : '';
  
  const gradients = [
    'linear-gradient(135deg, #ff8c00 0%, #ff6600 100%)',
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)'
  ];
  
  const timer = {
    id: oldTimerId, // Reuse same ID
    type: 'timer',
    duration: seconds,
    endTime: Date.now() + (seconds * 1000),
    status: 'running',
    tag: tag,
    startTime: Date.now(),
    interval: null,
    gradient: gradients[Math.floor(Math.random() * gradients.length)],
  };
  
  timers.push(timer);
  
  // Update existing floating window
  const floatingWindow = floatingWindows.get(oldTimerId);
  if (floatingWindow) {
    floatingWindow.webContents.send('init-floating-timer', {
      id: timer.id,
      tag: timer.tag,
      endTime: timer.endTime,
      duration: timer.duration,
      status: timer.status,
      gradient: timer.gradient
    });
  }
  
  // Start the timer interval
  timer.interval = setInterval(() => {
    const remaining = Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000));
    
    if (remaining === 0) {
      clearInterval(timer.interval);
      timer.status = 'completed';
      
      if (timers.length > 20) {
        timers = timers.slice(0, 20);
      }
      
      playNotificationSound();
      
      if (settings.showNotification) {
        const notification = new Notification({
          title: 'Timer Complete!',
          body: tag ? `Timer for #${tag} has finished` : 'Your timer has finished',
          silent: !settings.playSound,
        });
        notification.show();
      }
      
      if (mainWindow) {
        mainWindow.webContents.send('timer-complete', timer.id);
      }
      if (floatingWindows.has(timer.id)) {
        floatingWindows.get(timer.id).webContents.send('timer-complete', {
          id: timer.id,
          showAnimation: settings.showCompletionAnimation
        });
      }
      
      updateTrayTitle();
    } else {
      if (mainWindow) {
        mainWindow.webContents.send('timer-tick', { id: timer.id, remaining });
      }
      if (floatingWindows.has(timer.id)) {
        floatingWindows.get(timer.id).webContents.send('timer-tick', { id: timer.id, remaining });
      }
      updateTrayTitle();
    }
  }, 1000);
});

app.whenReady().then(() => {
  SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
  TIMERS_PATH = path.join(app.getPath('userData'), 'timers.json');
  loadSettings();
  loadTimers();
  createTray();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

setInterval(() => {
  updateTrayTitle();
}, 1000);

