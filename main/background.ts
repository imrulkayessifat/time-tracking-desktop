import path from 'path'
import {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut
} from 'electron'
import serve from 'electron-serve'

import { createWindow } from './helpers'
import startTracking from './helpers/active-log'
import startDurationTracking from './helpers/active-duration'
import { TaskIdleTracker } from './helpers/tracker/idle-tracker'
import { setupAuthIPC } from './helpers/auth-ipc-handler';
import captureAndSaveScreenshot from './helpers/capture-screenshot'
import { loadProcessorConfig } from './helpers/processor/load-config';
import { ScreenshotProcessor } from './helpers/processor/screenshot-processor';
import { ActivityProcessor } from './helpers/processor/activity-processor';
import { ConfigurationProcessor } from './helpers/processor/configuration-processor'

const isProd = process.env.NODE_ENV === 'production'

let mainWindow: BrowserWindow | null = null;
let lastScreenshotTime = { minutes: -1, hours: -1 };

let screenshotProcessor: ScreenshotProcessor;
let activityProcessor: ActivityProcessor;
let idleTracker: TaskIdleTracker;
let configurationProcessor: ConfigurationProcessor;
let apiEndpoint: string;

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

app.on('ready', async () => {
  mainWindow = createWindow('main', {
    height: 720,
    width: 500,
    minHeight: 720,
    minWidth: 360,
    maxWidth: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    resizable: true
  })
  mainWindow.setMenu(null);
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    mainWindow.webContents.toggleDevTools();
  });


  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/home`)
  }

  setupAuthIPC();
  // Load configuration
  const { apiEndpoint: configApiEndpoint, intervalMs } = await loadProcessorConfig();
  apiEndpoint = configApiEndpoint;
  screenshotProcessor = new ScreenshotProcessor(`${apiEndpoint}/screenshot/submit`, intervalMs);
  activityProcessor = new ActivityProcessor(`${apiEndpoint}/screenshot/submit`, intervalMs);
  configurationProcessor = new ConfigurationProcessor(`${apiEndpoint}/init-system`, 120000)
  idleTracker = new TaskIdleTracker(`${apiEndpoint}/idle-time-entry`, 15);

  // Initialize the processor with loaded config
  screenshotProcessor.startProcessing();
  activityProcessor.startProcessing();
  configurationProcessor.startProcessing();
  console.log('Screenshot processor started');
});


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

ipcMain.on('toggle-expand', (_, isExpanded) => {
  if (mainWindow) {
    console.log(isExpanded)
    const [width, height] = mainWindow.getSize();
    const newWidth = !isExpanded ? 1250 : 500
    mainWindow.setMinimumSize(!isExpanded ? 1000 : 360, 720)
    mainWindow.setMaximumSize(!isExpanded ? 99999 : 500, 99999)
    // console.log(mainWindow.getMaximumSize())
    mainWindow.setSize(newWidth, 720, true);
  }
});

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})

ipcMain.on('timer-update', (_, info: { project_id: number, selectedTaskId: number, hours: number, minutes: number, seconds: number }) => {
  const interval = configurationProcessor?.getScreenShotInterval() ?? 2;
  // const interval = 2

  console.log("interval", interval)
  const elapsedMinutes = (info.hours * 60 + info.minutes) - (lastScreenshotTime.hours * 60 + lastScreenshotTime.minutes);

  if (elapsedMinutes >= interval) {
    if (info.project_id !== -1) {
      if (typeof startTracking === 'function') {
        startTracking(info.project_id, info.selectedTaskId);
      } else {
        console.error("startTracking function is undefined");
      }

      captureAndSaveScreenshot(info);
    }
    lastScreenshotTime = { minutes: info.minutes, hours: info.hours };
  }
  // startDurationTracking(info.project_id, info.selectedTaskId, apiEndpoint)
});

// ipcMain.on('idle-started', (_, { project_id, task_id }) => {
//   idleTracker.startTracking(project_id, task_id);
// })

// ipcMain.on('idle-stopped', (_, { projectId, taskId }) => {
//   const totalIdleTime = idleTracker.stopTracking(projectId, taskId);
// });

