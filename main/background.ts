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
import { TaskIdleTracker } from './helpers/tracker/idle-tracker'
import { setupAuthIPC } from './helpers/auth-ipc-handler';
import captureAndSaveScreenshot from './helpers/capture-screenshot'
import { loadProcessorConfig } from './helpers/processor/load-config';
import { ScreenshotProcessor } from './helpers/processor/screenshot-processor';
import { ActivityProcessor } from './helpers/processor/activity-processor';
import { ConfigurationProcessor } from './helpers/processor/configuration-processor'

const isProd = process.env.NODE_ENV === 'production'

import * as fs from 'fs';

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let contextMenu: Menu | null = null;
let lastScreenshotTime = { minutes: -1, hours: -1 };


let screenshotProcessor: ScreenshotProcessor;
let activityProcessor: ActivityProcessor;
let idleTracker: TaskIdleTracker;
let configurationProcessor: ConfigurationProcessor;

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
  mainWindow.webContents.openDevTools();

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
  screenshotProcessor = new ScreenshotProcessor(`${apiEndpoint}/screenshot/submit`, intervalMs);
  activityProcessor = new ActivityProcessor(`${apiEndpoint}/screenshot/submit`, intervalMs);
  configurationProcessor = new ConfigurationProcessor(`${apiEndpoint}/configuration`, 120000)
  idleTracker = new TaskIdleTracker(`${apiEndpoint}/idle-time-entry`, 60);

  // Initialize the processor with loaded config
  screenshotProcessor.startProcessing();
  activityProcessor.startProcessing();
  configurationProcessor.startProcessing();
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
  idleTracker.clearAll();

  if (screenshotProcessor) {
    screenshotProcessor.stopProcessing();
  }

  if (activityProcessor) {
    activityProcessor.stopProcessing()
  }

  if (configurationProcessor) {
    configurationProcessor.stopProcessing()
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
  // const interval = configurationProcessor.getScreenShotInterval();
  const interval = 2

  console.log("interval", interval)
  const elapsedMinutes = (info.hours * 60 + info.minutes) - (lastScreenshotTime.hours * 60 + lastScreenshotTime.minutes);

  if (elapsedMinutes >= interval) {
    if (info.project_id !== -1) {
      startTracking(info.project_id, info.selectedTaskId);
      captureAndSaveScreenshot(info);
    }
    lastScreenshotTime = { minutes: info.minutes, hours: info.hours };
  }
});

ipcMain.on('idle-started', (_, { project_id, task_id }) => {
  idleTracker.startTracking(project_id, task_id);
})

ipcMain.on('idle-stopped', (_, { projectId, taskId }) => {
  const totalIdleTime = idleTracker.stopTracking(projectId, taskId);
});

