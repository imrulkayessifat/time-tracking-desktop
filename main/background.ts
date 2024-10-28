import path from 'path'
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  MenuItemConstructorOptions,
  Tray,
} from 'electron'
import serve from 'electron-serve'

import { createWindow } from './helpers'
import startTracking from './helpers/active-log'
import captureAndSaveScreenshot from './helpers/capture-screenshot'
import { loadProcessorConfig } from './helpers/processor/load-config';
import { setupAuthIPC } from './helpers/auth-ipc-handler';
import { ScreenshotProcessor } from './helpers/processor/screenshot-processor';
import { ActivityProcessor } from './helpers/processor/activity-processor';

const isProd = process.env.NODE_ENV === 'production'

import * as fs from 'fs';

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let contextMenu: Menu | null = null;
let lastScreenshotTime = { minutes: -1, hours: -1 };

let screenshotProcessor: ScreenshotProcessor;
let activityProcessor: ActivityProcessor;

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

; (async () => {
  await app.whenReady()

  mainWindow = createWindow('main', {
    height: 720,
    width: 1000,
    minHeight: 645,
    minWidth: 500,
    maxWidth: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    resizable: true
  })
  mainWindow.setMenu(null);
  // mainWindow.webContents.openDevTools();

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/home`)
  }
  createTray();
  setupAuthIPC();
  // Load configuration
  const { apiEndpoint, intervalMs } = await loadProcessorConfig();
  screenshotProcessor = new ScreenshotProcessor(apiEndpoint, intervalMs);
  activityProcessor = new ActivityProcessor(apiEndpoint, intervalMs)

  // Initialize the processor with loaded config
  screenshotProcessor.startProcessing();
  activityProcessor.startProcessing()
  console.log('Screenshot processor started');
})()

const createTray = () => {
  const imagePath = path.join(__dirname, 'images', 'asd-screen-recorder.png');

  if (!fs.existsSync(imagePath)) {
    console.error(`Image not found at path: ${imagePath}`);
    return;
  }

  tray = new Tray(imagePath);

  const menuTemplate: MenuItemConstructorOptions[] = [
    {
      label: 'Start Timer',
      click: () => {
        mainWindow?.webContents.send('toggle-timer');
      }
    },
    { label: 'Add Time Note', click: () => { /* ... */ } },
    {
      label: 'Open Timer',
      click: () => {
        mainWindow?.show();
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ];

  contextMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Time Tracking');
};

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  console.log('App is quitting, stopping screenshot processor...');
  if (screenshotProcessor) {
    screenshotProcessor.stopProcessing();
  }

  if (activityProcessor) {
    activityProcessor.stopProcessing()
  }
});

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})


const rebuildTrayMenu = (isRunning: boolean) => {
  if (tray) {
    const menuTemplate: MenuItemConstructorOptions[] = [
      {
        label: isRunning ? 'Stop Timer' : 'Start Timer',
        click: () => {
          mainWindow?.webContents.send('toggle-timer');
        }
      },
      { label: 'Add Time Note', click: () => { /* ... */ } },
      {
        label: 'Open Timer',
        click: () => {
          mainWindow?.show();
        }
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ];

    const newContextMenu = Menu.buildFromTemplate(menuTemplate);
    tray.setContextMenu(newContextMenu);
  }
};

ipcMain.on('toggle-expand', (_, isExpanded) => {
  if (mainWindow) {
    console.log(isExpanded)
    const [width, height] = mainWindow.getSize();
    const newWidth = !isExpanded ? 1250 : 500
    mainWindow.setMinimumSize(!isExpanded ? 1000 : 500, height)
    mainWindow.setMaximumSize(!isExpanded ? 99999 : 500, height)
    console.log(mainWindow.getMaximumSize())
    mainWindow.setSize(newWidth, height, true);
  }
});

ipcMain.on('timer-status-update', (_, isRunning: boolean) => {
  rebuildTrayMenu(isRunning);
});

ipcMain.on('timer-update', (_, info: { project_id: number, selectedTaskId: number, hours: number, minutes: number, seconds: number }) => {
  if (info.minutes !== lastScreenshotTime.minutes || info.hours !== lastScreenshotTime.hours) {
    if (info.selectedTaskId !== -1) {
      startTracking(info.project_id, info.selectedTaskId)
      captureAndSaveScreenshot(info);
    }
    lastScreenshotTime = { minutes: info.minutes, hours: info.hours };
  }
});
