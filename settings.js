const { ipcRenderer } = require('electron');
const path = require('path');

const showNotificationCheckbox = document.getElementById('showNotification');
const playSoundCheckbox = document.getElementById('playSound');
const notificationSoundSelect = document.getElementById('notificationSound');
const startAtLoginCheckbox = document.getElementById('startAtLogin');
const showCompletionAnimationCheckbox = document.getElementById('showCompletionAnimation');
const testSoundBtn = document.getElementById('testSoundBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const helpBtn = document.getElementById('helpBtn');
const helpPopup = document.getElementById('helpPopup');
const helpCloseBtn = document.getElementById('helpCloseBtn');
const presetsBtn = document.getElementById('presetsBtn');
const presetsPopup = document.getElementById('presetsPopup');
const presetsCloseBtn = document.getElementById('presetsCloseBtn');
const presetsList = document.getElementById('presetsList');
const presetName = document.getElementById('presetName');
const presetTime = document.getElementById('presetTime');
const addPresetBtn = document.getElementById('addPresetBtn');

let customPresets = [];
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const testAudio = document.getElementById('testAudio');

let currentSettings = {};

ipcRenderer.send('get-settings');

ipcRenderer.on('settings-data', (event, settings) => {
  currentSettings = settings;
  
  showNotificationCheckbox.checked = settings.showNotification;
  playSoundCheckbox.checked = settings.playSound;
  notificationSoundSelect.value = settings.notificationSound;
  startAtLoginCheckbox.checked = settings.startAtLogin;
  showCompletionAnimationCheckbox.checked = settings.showCompletionAnimation;
  
  const volume = settings.volume || 50;
  volumeSlider.value = volume;
  volumeValue.textContent = volume + '%';
  
  customPresets = settings.customPresets || [];
});

ipcRenderer.on('settings-saved', () => {
  window.close();
});

volumeSlider.addEventListener('input', () => {
  const volume = volumeSlider.value;
  volumeValue.textContent = volume + '%';
  testAudio.volume = volume / 100;
});

// Save settings when window is about to close
window.addEventListener('beforeunload', () => {
  const newSettings = {
    showNotification: showNotificationCheckbox.checked,
    playSound: playSoundCheckbox.checked,
    notificationSound: notificationSoundSelect.value,
    startAtLogin: startAtLoginCheckbox.checked,
    showCompletionAnimation: showCompletionAnimationCheckbox.checked,
    volume: parseInt(volumeSlider.value),
  };
  
  ipcRenderer.send('save-settings', newSettings);
});

testSoundBtn.addEventListener('click', () => {
  const soundName = notificationSoundSelect.value;
  const soundPath = path.join(__dirname, 'assets', 'sounds', `${soundName}.m4a`);
  
  testAudio.src = soundPath;
  testAudio.volume = volumeSlider.value / 100;
  testAudio.play().catch(err => {
    console.error('Error playing test sound:', err);
    alert('Could not play sound. Please ensure sound files are present.');
  });
});

saveBtn.addEventListener('click', () => {
  const newSettings = {
    showNotification: showNotificationCheckbox.checked,
    playSound: playSoundCheckbox.checked,
    notificationSound: notificationSoundSelect.value,
    startAtLogin: startAtLoginCheckbox.checked,
    showCompletionAnimation: showCompletionAnimationCheckbox.checked,
    volume: parseInt(volumeSlider.value),
  };
  
  ipcRenderer.send('save-settings', newSettings);
});

cancelBtn.addEventListener('click', () => {
  window.close();
});

helpBtn.addEventListener('click', () => {
  helpPopup.style.display = 'flex';
});

helpCloseBtn.addEventListener('click', () => {
  helpPopup.style.display = 'none';
});

helpPopup.addEventListener('click', (e) => {
  if (e.target === helpPopup) {
    helpPopup.style.display = 'none';
  }
});

presetsBtn.addEventListener('click', () => {
  presetsPopup.style.display = 'flex';
  ipcRenderer.send('get-presets');
});

ipcRenderer.on('presets-data', (event, presets) => {
  customPresets = presets;
  renderPresets();
});

presetsCloseBtn.addEventListener('click', () => {
  presetsPopup.style.display = 'none';
});

presetsPopup.addEventListener('click', (e) => {
  if (e.target === presetsPopup) {
    presetsPopup.style.display = 'none';
  }
});

addPresetBtn.addEventListener('click', () => {
  const name = presetName.value.trim();
  const time = presetTime.value.trim();
  
  if (name && time) {
    // Normalize time format (add space if missing)
    const normalizedTime = time.replace(/(\d+)(min|m|h|hour|hours)/, '$1 $2');
    customPresets.push({ 
      name, 
      time: `${name} ${normalizedTime}`,
      display: `${normalizedTime} ${name}`
    });
    presetName.value = '';
    presetTime.value = '';
    renderPresets();
    savePresets();
  }
});

function renderPresets() {
  presetsList.innerHTML = customPresets.map((preset, index) => `
    <div class="preset-item" id="preset-${index}">
      <div class="preset-info">
        <div class="preset-name" id="name-${index}">${preset.name}</div>
        <div class="preset-time" id="time-${index}">${preset.display || preset.time}</div>
      </div>
      <div class="preset-actions">
        <button class="preset-btn edit-btn" onclick="editPreset(${index})">Edit</button>
        <button class="preset-btn delete-btn" onclick="deletePreset(${index})">Delete</button>
      </div>
    </div>
  `).join('');
}

function editPreset(index) {
  const preset = customPresets[index];
  const presetItem = document.getElementById(`preset-${index}`);
  
  // Show current preset as editable text (like "Focus 25m" or "design logo 20min")
  const currentValue = `${preset.name} ${preset.time.split(' ').slice(1).join(' ')}`;
  
  presetItem.innerHTML = `
    <div class="preset-edit">
      <input type="text" value="${currentValue}" id="edit-input-${index}" 
             placeholder="e.g., Focus 25m, design logo 20min" 
             style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-right: 8px;">
      <button class="preset-btn edit-btn" onclick="savePreset(${index})">Save</button>
      <button class="preset-btn delete-btn" onclick="cancelEdit(${index})">Cancel</button>
    </div>
  `;
  
  // Focus and select all text
  const input = document.getElementById(`edit-input-${index}`);
  input.focus();
  input.select();
}

function savePreset(index) {
  const input = document.getElementById(`edit-input-${index}`);
  const value = input.value.trim();
  
  if (value) {
    // Parse the input to extract name and time
    const timeRegex = /(\d+)\s*(min|mins|m|h|hour|hours)\b/i;
    const timeMatch = value.match(timeRegex);
    
    if (timeMatch) {
      // Extract time part and normalize it
      const timeStr = timeMatch[0];
      const normalizedTime = timeStr.replace(/(\d+)(min|mins|m|h|hour|hours)/i, '$1 $2');
      
      // Extract name (everything before the time)
      const name = value.replace(timeRegex, '').trim();
      
      if (name) {
        customPresets[index] = {
          name: name,
          time: `${name} ${normalizedTime}`,
          display: `${normalizedTime} ${name}`
        };
        renderPresets();
        savePresets();
        return;
      }
    }
  }
  
  // If parsing failed, cancel edit
  renderPresets();
}

function cancelEdit(index) {
  renderPresets();
}

function deletePreset(index) {
  if (confirm('Delete this preset?')) {
    customPresets.splice(index, 1);
    renderPresets();
    savePresets();
  }
}

function savePresets() {
  ipcRenderer.send('save-presets', customPresets);
}

window.editPreset = editPreset;
window.savePreset = savePreset;
window.cancelEdit = cancelEdit;
window.deletePreset = deletePreset;

