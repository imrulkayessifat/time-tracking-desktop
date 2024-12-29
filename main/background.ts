import path from 'path'
import log from 'electron-log';
import {
  app,
  BrowserWindow,
  ipcMain,
  systemPreferences,
  globalShortcut,
  dialog,
  shell
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
import { TimeProcessor } from './helpers/processor/time-processor';
import { ActivityProcessor } from './helpers/processor/activity-processor';
import { ActiveDurationProcessor } from './helpers/processor/activeduration-processor';
import { ConfigurationProcessor } from './helpers/processor/configuration-processor'

const isProd = process.env.NODE_ENV === 'production'

export let mainWindow: BrowserWindow | null = null;
let lastScreenshotTime = { minutes: -1, hours: -1 };
let isAnyRunningTask: boolean | null = null;
let forceQuit = false;

let screenshotProcessor: ScreenshotProcessor;
let activityProcessor: ActivityProcessor;
let activeDuration: ActiveDurationProcessor;
let idleTracker: TaskIdleTracker;
let timeProcessor: TimeProcessor;
let configurationProcessor: ConfigurationProcessor;
let apiEndpoint: string = "https://timetracker.flytesolutions.com/api/v1/";
let intervalMs: number = 120000;

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

if (isProd) {
  log.transports.file.resolvePath = () => path.join(app.getPath('userData'), 'logs', 'main.log');
} else {
  log.transports.console.level = 'debug';
  // log.transports.file.resolvePath = () => path.join(app.getPath('userData'), 'logs', 'main.log');
}

console.log = log.info;
console.error = log.error;


async function checkAndRequestAccessibility(mainWindow: BrowserWindow) {
  if (systemPreferences.isTrustedAccessibilityClient(false)) {
    return true;
  }

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Accessibility Permission Required',
    message: 'This app requires accessibility permissions to function. Please grant permission in System Preferences.',
    buttons: ['Open Settings', 'Deny'],
    defaultId: 0
  });

  if (response === 1) {
    return false;
  }

  // Directly open accessibility settings
  // systemPreferences.isTrustedAccessibilityClient(true);
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');

  // Immediate check after opening settings
  const isAccessibilityGranted = systemPreferences.isTrustedAccessibilityClient(false);

  if (isAccessibilityGranted) {
    console.log('Accessibility permission granted successfully!');
    return true;
  }

  return systemPreferences.isTrustedAccessibilityClient(false);
}

async function checkAndRequestScreenRecording(mainWindow: BrowserWindow) {
  // Initial check of screen recording permission status
  if (systemPreferences.getMediaAccessStatus('screen') === 'granted') {
    return true;
  }
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Screen Recording Permission Required',
    message: 'This app requires screen recording permission to function properly. Please enable Screen Recording permission for the app.',
    buttons: ['Open Privacy Settings', 'Deny'],
    defaultId: 0
  });
  if (response === 1) {
    return false;
  }
  // Open directly to Screen Recording privacy settings
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');

  // Return the current status without showing another dialog
  return systemPreferences.getMediaAccessStatus('screen') === 'granted';
}


app.on('ready', async () => {
  mainWindow = createWindow('main', {
    height: 720,
    width: 500,
    minHeight: 500,
    minWidth: 360,
    maxWidth: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    resizable: true,
    icon: path.join(app.getAppPath(), "resources/icon.png")
  })
  mainWindow.setMenu(null);
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    mainWindow.webContents.toggleDevTools();
  });

  console.log("icon path : ", path.join(app.getAppPath(), "resources/icon.png"))
  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/home`)
  }

  if (process.platform === 'darwin') {
    const accessibilityPermission = await checkAndRequestAccessibility(mainWindow);

    const screenRecordingPermission = await checkAndRequestScreenRecording(mainWindow);

  }

  mainWindow.on('close', async (e) => {
    if (forceQuit) {
      return; // Allow the close if forceQuit is true
    }

    e.preventDefault(); // Prevents the window from closing
    console.log("isAnyRunningTask : ", isAnyRunningTask)

    if (isAnyRunningTask) {
      await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['OK'],
        title: 'Task Running',
        message: 'Please stop the running task before closing the application.',
        defaultId: 0,
      });
      return; // Prevents the app from closing
    }

    // Only show quit confirmation if no task is running
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Yes', 'No'],
      title: 'Confirm',
      message: 'Are you sure you want to quit?',
      defaultId: 1, // Default to "No"
      cancelId: 1
    });

    if (choice.response === 0) {  // If user clicks "Yes"
      forceQuit = true; // Set the flag to allow the close
      idleTracker.clearAll();

      app.quit()
    }
  });


  setupAuthIPC();
  // Load configuration
  // const { apiEndpoint: configApiEndpoint, intervalMs } = await loadProcessorConfig();
  // apiEndpoint = configApiEndpoint;

  console.log("api endpoint :", apiEndpoint, intervalMs)
  screenshotProcessor = new ScreenshotProcessor(`${apiEndpoint}/screenshot/submit`, 30000);
  // activityProcessor = new ActivityProcessor(`${apiEndpoint}/screenshot/submit`, 30000);
  // await activityProcessor.waitForInitialization();

  activeDuration = new ActiveDurationProcessor(`${apiEndpoint}/activity/app-usages`, 30000)
  await activeDuration.waitForInitialization();

  timeProcessor = new TimeProcessor(`${apiEndpoint}/track/bulk`, 60000);
  await timeProcessor.waitForInitialization();

  configurationProcessor = new ConfigurationProcessor(`${apiEndpoint}/init-system`, 120000)
  idleTracker = new TaskIdleTracker(`${apiEndpoint}/idle-time-entry`, 300);

});

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('toggle-expand', (_, isExpanded) => {
  if (mainWindow) {
    console.log(isExpanded)
    const [width, height] = mainWindow.getSize();
    const newWidth = !isExpanded ? 1250 : 500
    mainWindow.setMinimumSize(!isExpanded ? 1000 : 360, 500)
    mainWindow.setMaximumSize(!isExpanded ? 99999 : 500, 99999)
    // console.log(mainWindow.getMaximumSize())
    mainWindow.setSize(newWidth, 720, true);
  }
});

ipcMain.on('permission-check', async () => {
  if (process.platform === 'darwin') {
    const accessibilityPermission = await checkAndRequestAccessibility(mainWindow);

    const screenRecordingPermission = await checkAndRequestScreenRecording(mainWindow);
  }
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})

ipcMain.on('timer-update', (_, info: { project_id: number, selectedTaskId: number, isRunning: boolean, hours: number, minutes: number, seconds: number }) => {
  const interval = configurationProcessor?.getScreenShotInterval() ?? 2;
  // const interval = 2
  console.log("interval", interval)
  const elapsedMinutes = (info.hours * 60 + info.minutes) - (lastScreenshotTime.hours * 60 + lastScreenshotTime.minutes);

  if (elapsedMinutes >= interval) {
    if (info.project_id !== -1) {
      // try {
      //   startTracking(info.project_id, info.selectedTaskId);
      // } catch (error) {
      //   console.error('Error starting timer tracking:', error);
      // }
      captureAndSaveScreenshot(info);
    }
    lastScreenshotTime = { minutes: info.minutes, hours: info.hours };
  }
  startDurationTracking(info.project_id, info.selectedTaskId, apiEndpoint)
});

ipcMain.on('idle-started', (_, { projectId, taskId }) => {
  try {
    isAnyRunningTask = true
    const timeEntryId = timeProcessor.insertStartTime(projectId, taskId);
    idleTracker.startTracking(projectId, taskId);
    screenshotProcessor.startProcessing();
    // activityProcessor.startProcessing();
    activeDuration.startProcessing()
    configurationProcessor.startProcessing();
    timeProcessor.startProcessing()
  } catch (error) {
    console.error('Error starting idle tracking:', error);
  }
})

ipcMain.on('idle-stopped', (_, { projectId, isRunning, taskId }) => {
  try {
    isAnyRunningTask = false
    const totalIdleTime = idleTracker.stopTracking(projectId, taskId);
    screenshotProcessor.stopProcessing();
    // activityProcessor.stopProcessing();
    activeDuration.stopProcessing();

    configurationProcessor.stopProcessing()
    const latestTimeEntry = timeProcessor.getLatestUnfinishedTimeEntry(projectId, taskId);
    if (latestTimeEntry) {
      timeProcessor.updateEndTime(latestTimeEntry.id);
    }
    timeProcessor.stopProcessing()
    timeProcessor.processTimeEntries()
    activeDuration.processActivities()

  } catch (error) {
    console.error('Error stoping idle tracking:', error);
  }
});

