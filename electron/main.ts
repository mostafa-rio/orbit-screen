import { app, BrowserWindow, ipcMain, desktopCapturer, dialog, systemPreferences, shell, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import ffmpeg from 'fluent-ffmpeg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '..');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.APP_ROOT : path.join(process.env.APP_ROOT, 'public');

let win: BrowserWindow | null;
let cameraWin: BrowserWindow | null = null;

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

app.setName('Orbit Screen');

let ffmpegPath = '';
if (app.isPackaged) {
  ffmpegPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg');
} else {
  ffmpegPath = path.join(process.env.APP_ROOT, 'node_modules', 'ffmpeg-static', 'ffmpeg');
}
ffmpeg.setFfmpegPath(ffmpegPath);

let defaultSavePath = '';
let onboardingComplete = false;
let cameraShape = 'circle';
let cameraRadius = 24;
let cameraBorderEnabled = true;
let cameraBorderColor = '#ffffff';
let configPath = '';

async function loadConfig() {
  configPath = path.join(app.getPath('userData'), 'orbit-config.json');
  try {
    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    defaultSavePath = config.defaultSavePath || '';
    onboardingComplete = config.onboardingComplete || false;
    cameraShape = config.cameraShape || 'circle';
    cameraRadius = config.cameraRadius ?? 24;
    cameraBorderEnabled = config.cameraBorderEnabled ?? true;
    cameraBorderColor = config.cameraBorderColor || '#ffffff';
  } catch (e) {
    // ignore
  }
}

async function saveConfig() {
  try {
    await fs.writeFile(configPath, JSON.stringify({ defaultSavePath, onboardingComplete, cameraShape, cameraRadius, cameraBorderEnabled, cameraBorderColor }));
  } catch (e) {
    console.error("Failed to save config", e);
  }
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'orbit-logo.png'),
    width: onboardingComplete ? 760 : 500,
    height: onboardingComplete ? 70 : 750,
    resizable: !onboardingComplete,
    frame: false,
    transparent: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.APP_ROOT, 'dist', 'index.html'));
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.whenReady().then(async () => {
  await loadConfig();
  createWindow();
});

ipcMain.handle('get-config', () => {
  return { onboardingComplete, defaultSavePath, cameraShape, cameraRadius, cameraBorderEnabled, cameraBorderColor };
});

ipcMain.handle('check-permissions', async () => {
  let screenAccess = true;
  let accessibilityAccess = true;
  if (process.platform === 'darwin') {
    screenAccess = systemPreferences.getMediaAccessStatus('screen') === 'granted';
    accessibilityAccess = systemPreferences.isTrustedAccessibilityClient(false);
  }
  return { screenAccess, accessibilityAccess };
});

ipcMain.on('request-camera-mic', async () => {
  if (process.platform === 'darwin') {
    if (systemPreferences.getMediaAccessStatus('camera') !== 'granted') {
      await systemPreferences.askForMediaAccess('camera');
    }
    if (systemPreferences.getMediaAccessStatus('microphone') !== 'granted') {
      await systemPreferences.askForMediaAccess('microphone');
    }
  }
});

ipcMain.on('request-accessibility', () => {
  if (process.platform === 'darwin') {
    systemPreferences.isTrustedAccessibilityClient(true);
  }
});

ipcMain.on('open-accessibility-preferences', () => {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
});

ipcMain.on('open-system-preferences', () => {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
});

ipcMain.on('complete-onboarding', async () => {
  onboardingComplete = true;
  await saveConfig();
  if (win) {
    win.setResizable(true);
    win.setSize(760, 70);
    win.center();
    win.setResizable(false);
  }
});

ipcMain.on('resize-window', (event, { width, height }) => {
  if (win) {
    win.setResizable(true);
    win.setSize(width, height);
    win.center();
    win.setResizable(false);
  }
});

let settingsWin: BrowserWindow | null = null;
ipcMain.on('open-settings', () => {
  if (settingsWin) {
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 450,
    height: 550,
    title: 'Orbit Screen Settings',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  
  // We can just load a simple HTML for settings
  if (VITE_DEV_SERVER_URL) {
    settingsWin.loadURL(`${VITE_DEV_SERVER_URL}settings.html`);
  } else {
    settingsWin.loadFile(path.join(process.env.APP_ROOT, 'dist', 'settings.html'));
  }
  
  settingsWin.on('closed', () => {
    settingsWin = null;
  });
});

ipcMain.on('close-app', () => {
  app.quit();
});

ipcMain.handle('get-sources', async (event, type = 'screen') => {
  try {
    let hasAccess = true;
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('screen');
      hasAccess = status === 'granted';
      
      if (!hasAccess) {
        // We still want to call getSources to trigger the macOS permission prompt!
        // So we won't return early here.
      }
    }

    const sources = await desktopCapturer.getSources({ types: [type] });
    return {
      hasAccess,
      sources: sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
      }))
    };
  } catch (err) {
    console.error('Failed to get sources:', err);
    let hasAccess = false;
    if (process.platform === 'darwin') {
      hasAccess = systemPreferences.getMediaAccessStatus('screen') === 'granted';
    }
    return { sources: [], hasAccess };
  }
});

ipcMain.on('show-camera', (event, cameraId) => {
  if (cameraWin) {
    cameraWin.close();
  }
  if (cameraId && cameraId !== 'none') {
    let width = 300;
    let height = 300;
    if (cameraShape === 'rectangle') {
      width = 340;
      height = 220;
    }

    cameraWin = new BrowserWindow({
      width,
      height,
      transparent: true,
      frame: false,
      hasShadow: false,
      alwaysOnTop: true,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Ensure the camera follows the user across all macOS desktops/spaces
    cameraWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // Ensure it stays on top even over full screen apps
    cameraWin.setAlwaysOnTop(true, 'screen-saver', 1);

    if (VITE_DEV_SERVER_URL) {
      cameraWin.loadURL(`${VITE_DEV_SERVER_URL}camera.html?cameraId=${cameraId}&shape=${cameraShape}&radius=${cameraRadius}&borderEnabled=${cameraBorderEnabled}&borderColor=${encodeURIComponent(cameraBorderColor)}`);
    } else {
      cameraWin.loadFile(path.join(process.env.APP_ROOT, 'dist', 'camera.html'), { query: { cameraId, shape: cameraShape, radius: cameraRadius.toString(), borderEnabled: cameraBorderEnabled.toString(), borderColor: cameraBorderColor } });
    }
  }
});

ipcMain.on('hide-camera', () => {
  if (cameraWin) {
    cameraWin.close();
    cameraWin = null;
  }
});

ipcMain.on('start-recording-setup', (event, { screenId, micId }) => {
  if (win) {
    win.webContents.send('start-recording', { screenId, micId });
  }
});

let tray: Tray | null = null;

ipcMain.on('recording-started', () => {
  if (win) win.hide();
  if (!tray) {
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    tray.setTitle('🔴 Recording');
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Stop Recording', click: () => { if (win) win.webContents.send('force-stop-recording'); } },
    ]);
    tray.setToolTip('Orbit Screen Recording');
    tray.setContextMenu(contextMenu);
  }
});

ipcMain.on('recording-stopped', () => {
  if (win) win.show();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

ipcMain.on('stop-recording-setup', () => {
  // We keep the camera open even when recording stops, unless they select "No camera"
});

ipcMain.handle('get-default-path', () => {
  return defaultSavePath;
});

ipcMain.on('set-camera-shape', async (event, shape, radius) => {
  cameraShape = shape;
  if (radius !== undefined) cameraRadius = radius;
  await saveConfig();
  if (cameraWin) {
    let width = 300;
    let height = 300;
    if (cameraShape === 'rectangle' || cameraShape === 'rectangle-h') {
      width = 340;
      height = 220;
    } else if (cameraShape === 'rectangle-v') {
      width = 220;
      height = 340;
    }
    cameraWin.setSize(width, height);
    cameraWin.webContents.send('update-shape', shape, cameraRadius);
  }
});

ipcMain.on('set-camera-border', async (event, enabled, color) => {
  cameraBorderEnabled = enabled;
  cameraBorderColor = color;
  await saveConfig();
  if (cameraWin) {
    cameraWin.webContents.send('update-border', enabled, color);
  }
});

ipcMain.handle('select-default-path', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Default Save Folder',
    properties: ['openDirectory', 'createDirectory']
  });
  if (!canceled && filePaths.length > 0) {
    defaultSavePath = filePaths[0];
    await saveConfig();
    return defaultSavePath;
  }
  return null;
});

ipcMain.on('save-video', async (event, arrayBuffer) => {
  const buffer = Buffer.from(arrayBuffer);
  let targetPath = '';

  if (defaultSavePath) {
    targetPath = path.join(defaultSavePath, `Orbit-Recording-${Date.now()}.mp4`);
  } else {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save Recording',
      defaultPath: `Orbit-Recording-${Date.now()}.mp4`,
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
    });
    if (!filePath) return;
    targetPath = filePath;
  }

  const tempWebm = path.join(os.tmpdir(), `orbit-temp-${Date.now()}.webm`);
  await fs.writeFile(tempWebm, buffer);

  const isMac = process.platform === 'darwin';
  
  const outputOpts = isMac ? [
    '-c:v h264_videotoolbox',
    '-b:v 8M',
    '-vsync 2',
    '-c:a aac',
    '-b:a 192k'
  ] : [
    '-c:v libx264',
    '-preset fast',
    '-crf 23',
    '-c:a aac',
    '-b:a 192k'
  ];

  ffmpeg(tempWebm)
    .outputOptions(outputOpts)
    .on('end', async () => {
      await fs.unlink(tempWebm).catch(() => {});
      console.log('MP4 conversion complete:', targetPath);
      shell.showItemInFolder(targetPath);
    })
    .on('error', (err) => {
      console.error('Error converting to MP4:', err);
    })
    .save(targetPath);
});
