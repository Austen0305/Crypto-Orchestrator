import { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell, autoUpdater, Notification } from 'electron';
import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

// Keep a global reference of the window object
let mainWindow;
let tray = null;
let fastapiProcess = null;
let fastapiHealthInterval = null;

// Desktop-specific settings
let autoStartEnabled = true;
let notificationsEnabled = true;

// Add crash reporting
import { init as initCrashReporter } from '@sentry/electron';
initCrashReporter({
  dsn: 'YOUR_SENTRY_DSN',
  tracesSampleRate: 1.0,
  release: app.getVersion(),
  environment: isDev ? 'development' : 'production'
});

// Function to create the main application window
function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: app.isPackaged ? path.join(path.dirname(app.getAppPath()), 'client', 'public', 'favicon.png') : path.join(__dirname, '../client/public/favicon.png'),
    show: false, // Don't show until ready
    titleBarStyle: 'default',
    autoHideMenuBar: true
  });

  // Load the app
  const startUrl = isDev
    ? 'http://localhost:5173' // Vite dev server
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  console.log(`[Electron] Loading URL: ${startUrl}`);

  mainWindow.loadURL(startUrl);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Open DevTools in development
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window minimize to tray if supported
  mainWindow.on('minimize', (event) => {
    if (tray && process.platform === 'win32') {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// Create system tray
function createTray() {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    const iconPath = app.isPackaged ? path.join(path.dirname(app.getAppPath()), 'client', 'public', 'favicon.png') : path.join(__dirname, '../client/public/favicon.png');
    tray = new Tray(iconPath);

    updateTrayMenu();

    tray.setToolTip('CryptoOrchestrator - AI Trading Platform');

    tray.on('click', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  }
}

// Enhanced FastAPI server management
async function startFastAPIServer() {
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const serverPath = app.isPackaged
    ? path.join(path.dirname(app.getAppPath()), 'server_fastapi', 'main.py')
    : path.join(__dirname, '../server_fastapi', 'main.py');

  // Check Python installation
  try {
    await exec(`${pythonPath} --version`);
  } catch (error) {
    dialog.showErrorBox(
      'Python Not Found',
      'Python 3.8+ is required to run CryptoOrchestrator. Please install Python and try again.'
    );
    app.quit();
    return;
  }

  // Start FastAPI process
  fastapiProcess = spawn(pythonPath, [serverPath], {
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      FASTAPI_ENV: app.isPackaged ? 'production' : 'development'
    }
  });

  // Handle process output
  fastapiProcess.stdout.on('data', (data) => {
    console.log(`[FastAPI] ${data.toString().trim()}`);
    mainWindow?.webContents.send('server-log', data.toString());
  });

  fastapiProcess.stderr.on('data', (data) => {
    console.error(`[FastAPI Error] ${data.toString().trim()}`);
    mainWindow?.webContents.send('server-error', data.toString());
  });

  // Handle process exit
  fastapiProcess.on('close', (code) => {
    console.log(`[FastAPI] Process exited with code ${code}`);
    if (fastapiHealthInterval) {
      clearInterval(fastapiHealthInterval);
      fastapiHealthInterval = null;
    }
    if (code !== 0 && !app.isQuiting) {
      dialog.showErrorBox(
        'Server Error',
        `FastAPI server exited with code ${code}. Please restart the application.`
      );
      app.quit();
    }
  });

  fastapiProcess.on('error', (error) => {
    console.error(`[FastAPI] Process error: ${error.message}`);
    dialog.showErrorBox('Server Error', `Failed to start FastAPI server: ${error.message}`);
    app.quit();
  });

  // Start health checks after server starts
  setTimeout(() => {
    startFastAPIHealthChecks();
  }, 3000); // Wait 3 seconds for server to start
}

// Health check function for FastAPI server
async function checkFastAPIHealth() {
  const http = require('http');

  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8000,
      path: '/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve(res.statusCode === 200);
      });
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Start periodic health checks
function startFastAPIHealthChecks() {
  if (fastapiHealthInterval) return;

  fastapiHealthInterval = setInterval(async () => {
    const isHealthy = await checkFastAPIHealth();
    if (mainWindow) {
      mainWindow.webContents.send('server-health', isHealthy);
    }

    if (!isHealthy) {
      console.warn('[Electron] FastAPI server health check failed');
    } else {
      console.log('[Electron] FastAPI server is healthy');
    }
  }, 30000); // Check every 30 seconds
}

// Add auto-updater
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update-available');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (error) => {
    mainWindow?.webContents.send('update-error', error.message);
  });

  // Check for updates every hour
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 3600000);
}

// App event handlers
app.whenReady().then(async () => {
  // Start FastAPI server first
  await startFastAPIServer();

  createWindow();
  createTray();
  setupAutoUpdater();

  // Initialize auto-start based on saved preference
  if (process.platform === 'win32' || process.platform === 'darwin') {
    // Load saved preferences (simplified - in production, use a config file)
    try {
      const loginItemSettings = app.getLoginItemSettings();
      autoStartEnabled = loginItemSettings.openAtLogin;
      updateTrayMenu(); // Update tray menu after initialization
    } catch (error) {
      console.warn('[Electron] Failed to load auto-start preference:', error);
    }
  }

  // Show welcome notification on first run
  setTimeout(() => {
    if (notificationsEnabled && Notification.isSupported()) {
      const welcomeNotification = new Notification({
        title: 'CryptoOrchestrator Started',
        body: 'AI trading platform is ready. Your bots are standing by!',
        icon: path.join(__dirname, '../client/public/favicon.png')
      });
      welcomeNotification.show();
      setTimeout(() => welcomeNotification.close(), 5000);
    }
  }, 2000);

  // Set up application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Bot',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-bot');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Trading',
      submenu: [
        {
          label: 'Start All Bots',
          click: () => {
            mainWindow.webContents.send('menu-start-all-bots');
          }
        },
        {
          label: 'Stop All Bots',
          click: () => {
            mainWindow.webContents.send('menu-stop-all-bots');
          }
        },
        { type: 'separator' },
        {
          label: 'Paper Trading Mode',
          type: 'checkbox',
          checked: true,
          click: (menuItem) => {
            mainWindow.webContents.send('menu-toggle-paper-mode', menuItem.checked);
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://docs.cryptoorchestrator.com');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/yourusername/CryptoOrchestrator/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'About CryptoOrchestrator',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About CryptoOrchestrator',
              message: 'CryptoOrchestrator v1.0.0',
              detail: 'Professional AI-Powered Crypto Trading Platform\n\nBuilt with React, FastAPI, and Electron'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

// Graceful shutdown for Electron and FastAPI
async function gracefulShutdown() {
  console.log('[Electron] Initiating graceful shutdown...');

  // Stop health checks
  if (fastapiHealthInterval) {
    clearInterval(fastapiHealthInterval);
    fastapiHealthInterval = null;
  }

  // Gracefully terminate FastAPI server
  if (fastapiProcess) {
    console.log('[Electron] Terminating FastAPI server...');

    // Try to send SIGTERM first for graceful shutdown
    try {
      if (process.platform === 'win32') {
        // On Windows, use taskkill to kill the process tree
        exec(`taskkill /pid ${fastapiProcess.pid} /t /f`, (error) => {
          if (error) {
            console.error('[Electron] Error terminating FastAPI process:', error);
          } else {
            console.log('[Electron] FastAPI server terminated successfully');
          }
        });
      } else {
        // On Unix-like systems, send SIGTERM to process group
        process.kill(-fastapiProcess.pid, 'SIGTERM');
      }
    } catch (e) {
      console.error('[Electron] Error during FastAPI shutdown:', e);
      try {
        fastapiProcess.kill('SIGKILL');
      } catch (killError) {
        console.error('[Electron] Failed to kill FastAPI process:', killError);
      }
    }

    // Wait a bit for the process to terminate
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', async () => {
  await gracefulShutdown();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app before quit event for graceful shutdown
app.on('before-quit', async (event) => {
  if (!app.isQuiting) {
    event.preventDefault();
    app.isQuiting = true;
    await gracefulShutdown();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app ready to start services
app.whenReady().then(() => {
  // Start FastAPI server first
  startFastAPIServer();

  createWindow();
  createTray();
  setupAutoUpdater();
});

// Handle app being reopened on macOS
app.on('browser-window-focus', () => {
  // Handle any focus-related tasks
  updateTrayMenu();
});

// IPC handlers for communication with renderer
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

ipcMain.handle('minimize-to-tray', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.handle('show-window', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

// Desktop notification handler
ipcMain.handle('show-notification', async (event, options) => {
  if (!notificationsEnabled) return;

  const { title, body, icon, onClick } = options;

  // Check if notifications are supported
  if (!Notification.isSupported()) {
    console.warn('[Electron] Desktop notifications not supported');
    return;
  }

  const notification = new Notification({
    title: title || 'CryptoOrchestrator',
    body: body || '',
    icon: icon || path.join(__dirname, '../client/public/favicon.png'),
    silent: false
  });

  notification.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    if (onClick) {
      mainWindow?.webContents.send('notification-clicked', onClick);
    }
  });

  notification.show();

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    notification.close();
  }, 5000);
});

// Auto-start management
ipcMain.handle('set-auto-start', async (event, enabled) => {
  autoStartEnabled = enabled;

  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: false,
      path: process.execPath
    });
  } else if (process.platform === 'darwin') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: false
    });
  }

  return enabled;
});

ipcMain.handle('get-auto-start', () => {
  return autoStartEnabled;
});

// Notification preferences
ipcMain.handle('set-notifications-enabled', async (event, enabled) => {
  notificationsEnabled = enabled;
  return enabled;
});

ipcMain.handle('get-notifications-enabled', () => {
  return notificationsEnabled;
});

// System tray with auto-start toggle
function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show CryptoOrchestrator',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Hide to Tray',
      click: () => {
        mainWindow.hide();
      }
    },
    { type: 'separator' },
    {
      label: 'Auto-start on Login',
      type: 'checkbox',
      checked: autoStartEnabled,
      click: (menuItem) => {
        autoStartEnabled = menuItem.checked;
        mainWindow?.webContents.send('auto-start-changed', autoStartEnabled);
      }
    },
    {
      label: 'Enable Notifications',
      type: 'checkbox',
      checked: notificationsEnabled,
      click: (menuItem) => {
        notificationsEnabled = menuItem.checked;
        mainWindow?.webContents.send('notifications-changed', notificationsEnabled);
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

  tray.setContextMenu(contextMenu);
}

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Error', `An unexpected error occurred: ${error.message}`);

  // Show notification for critical errors
  if (notificationsEnabled && Notification.isSupported()) {
    const errorNotification = new Notification({
      title: 'CryptoOrchestrator Error',
      body: 'An unexpected error occurred. Please check the logs.',
      icon: path.join(__dirname, '../client/public/favicon.png')
    });
    errorNotification.show();
    setTimeout(() => errorNotification.close(), 10000);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);

  // Show notification for critical errors
  if (notificationsEnabled && Notification.isSupported()) {
    const errorNotification = new Notification({
      title: 'CryptoOrchestrator Error',
      body: 'An unhandled promise rejection occurred.',
      icon: path.join(__dirname, '../client/public/favicon.png')
    });
    errorNotification.show();
    setTimeout(() => errorNotification.close(), 10000);
  }
});
