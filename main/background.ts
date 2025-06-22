import path from 'path'
import log from 'electron-log';
const os = require('os');
import fs from 'fs';
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
import { exec, execFile } from 'child_process';
import { promisify } from 'util';

import { createWindow } from './helpers'
import startDurationTracking from './helpers/active-duration'
import startUrlTracking from './helpers/active-url';
import { TaskIdleTracker } from './helpers/tracker/idle-tracker'
import { setupAuthIPC } from './helpers/auth-ipc-handler';
import captureAndSaveScreenshot from './helpers/capture-screenshot'
import { ScreenshotProcessor } from './helpers/processor/screenshot-processor';
import { TimeProcessor } from './helpers/processor/time-processor';
import { AttendanceProcessor } from './helpers/processor/attendance-processor';
import { IdleTimeProcessor } from './helpers/processor/idletime-processor';
import { ActiveDurationProcessor } from './helpers/processor/activeduration-processor';
import { UrlProcessor } from './helpers/processor/url-processor';
import { ConfigurationProcessor } from './helpers/processor/configuration-processor'
import { getLastCloseTime, updateTimestamp } from './helpers/timestamp';

const isProd = process.env.NODE_ENV === 'production'
const execAsync = promisify(exec);

export let mainWindow: BrowserWindow | null = null;
let isAnyRunningTask: boolean | null = null;
let forceQuit = false;

let screenshotProcessor: ScreenshotProcessor;
let activeDuration: ActiveDurationProcessor;
let urlProcessor: UrlProcessor;
let idleTracker: TaskIdleTracker;
let timeProcessor: TimeProcessor;
let attendanceProcessor:AttendanceProcessor;
let idleProcessor: IdleTimeProcessor;
let configurationProcessor: ConfigurationProcessor;
let apiEndpoint: string = "https://api.stafftimetrack.com/api/v1";
// let apiEndpoint: string = "http://174.138.65.128:9091/api/v1"
let intervalMs: number = 120000;
let cleanTemp
if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

if (isProd) {
  log.transports.file.resolvePath = () => path.join(app.getPath('userData'), 'logs', 'main.log');
  log.transports.console.level = 'debug';
  console.log = log.info;
  console.error = log.error;
}


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

const deleteLogFile = () => {
  try {
    const logPath = path.join(app.getPath('userData'), 'logs', 'main.log');
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
      console.log('Successfully deleted log file');
    }
  } catch (error) {
    console.error('Error deleting log file:', error);
  }
};

const getSafariActiveUrl = async (): Promise<string> => {
  try {
    const { stdout } = await execAsync(
      "osascript -e 'tell application \"Safari\" to get URL of front document'"
    );
    return stdout.trim();
  } catch (error) {
    console.error("Error getting Safari URL:", error);
    return "";
  }
};

const getChromeBasedBrowserUrl = async () => {
  const chromeScript = `tell application "Google Chrome"
          get URL of active tab of front window
      end tell`;

  try {
    const { stdout } = await execAsync(`osascript -e '${chromeScript}'`);
    console.log("chrome permission : ", stdout.trim());
  } catch (error) {
    console.error(`Error getting URL:`, error);
  }
};

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
      backgroundThrottling: false
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
      // deleteLogFile();
      app.quit()
    }
  });


  setupAuthIPC();
  // Load configuration

  console.log("api endpoint :", apiEndpoint, intervalMs)
  screenshotProcessor = new ScreenshotProcessor(`${apiEndpoint}/screenshot/submit`, 30000);

  activeDuration = new ActiveDurationProcessor(`${apiEndpoint}/activity/app-usages`, 30000)
  await activeDuration.waitForInitialization();

  urlProcessor = new UrlProcessor(`${apiEndpoint}/activity/app-usages`, 30000)
  await urlProcessor.waitForInitialization()

  timeProcessor = new TimeProcessor(`${apiEndpoint}/track/bulk`, 30000);
  await timeProcessor.waitForInitialization();

  attendanceProcessor = new AttendanceProcessor(`${apiEndpoint}/track/attendance`, 30000)
  await attendanceProcessor.waitForInitialization()

  idleProcessor = new IdleTimeProcessor(`${apiEndpoint}/idle-time-entry`, 30000)
  await idleProcessor.waitForInitialization()

  configurationProcessor = new ConfigurationProcessor(`${apiEndpoint}/init-system`)
  idleTracker = new TaskIdleTracker(`${apiEndpoint}/idle-time-entry`, 10);

  if (process.platform === 'darwin') {
    await getSafariActiveUrl()
    await getChromeBasedBrowserUrl()
  }

  const lastEntry = timeProcessor.getLastUnfinishedTimeEntryFUS()
  if (lastEntry) {
    const shutdownTime = getLastCloseTime()
    if (shutdownTime) {
      console.log("shutdowntime : ", shutdownTime)
      timeProcessor.updateEndTime(lastEntry.id, shutdownTime);
    }
  }

});

app.on('window-all-closed', () => {
  app.quit()
})

// const updateInterval = setInterval(updateTimestamp, 10000)
function cleanTempFiles() {
  const tempDir = os.tmpdir();
  fs.readdir(tempDir, (err, files) => {
    if (err) return;
    files.forEach(file => {
      if (file.startsWith('_MEI')) {
        const filePath = path.join(tempDir, file);
        fs.rm(filePath, { recursive: true, force: true }, () => { });
      }
    });
  });
}
if (process.platform === 'win32') {

  cleanTemp = setInterval(cleanTempFiles, 30000)
}

app.on('will-quit', () => {
  if (process.platform === 'win32') {
    clearInterval(cleanTemp);
  }
})

ipcMain.on('toggle-expand', (_, isExpanded) => {
  if (mainWindow) {
    console.log(isExpanded)
    const [width, height] = mainWindow.getSize();
    const newWidth = !isExpanded ? 1250 : 500
    mainWindow.setMinimumSize(!isExpanded ? 1000 : 360, 500)
    mainWindow.setMaximumSize(!isExpanded ? 99999 : 500, 99999)
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

ipcMain.on('timer-update', async (_, info: { project_id: number, selectedTaskId: number, isRunning: boolean, hours: number, minutes: number, seconds: number }) => {
  const interval = await configurationProcessor?.getScreenShotInterval() ?? 2;
  const isUrlTracking = await configurationProcessor?.isUrlTracking() ?? false;
  const isScreenShotTracking = await configurationProcessor?.isScreenShotTracking() ?? false;
  console.error("interval", interval, info.minutes, info.seconds, isUrlTracking)

  if(isScreenShotTracking) {
    if (((info.minutes % interval === 0) && info.seconds === 0) || (info.minutes == 0 && info.seconds === 0)) {
      if (info.project_id !== -1) {
        captureAndSaveScreenshot(info);
      }
    }
  }

  startDurationTracking(info.project_id, info.selectedTaskId)
  if (isUrlTracking && (info.seconds % 5 === 0)) {
    startUrlTracking(info.project_id, info.selectedTaskId)
  }
  updateTimestamp()
});

ipcMain.on('idle-started', (_, { projectId, taskId }) => {
  try {
    isAnyRunningTask = true
    const timeEntryId = timeProcessor.insertStartTime(projectId, taskId);
    attendanceProcessor.insertAttendanceStart()
    idleTracker.startTracking(projectId, taskId);
    screenshotProcessor.startProcessing();
    activeDuration.startProcessing()
    urlProcessor.startProcessing()
    configurationProcessor.startProcessing();
    timeProcessor.startProcessing()
    attendanceProcessor.startProcessing()
    idleProcessor.startProcessing()
  } catch (error) {
    console.error('Error starting idle tracking:', error);
  }
})

ipcMain.on('idle-stopped', (_, { projectId, isRunning, taskId }) => {
  try {
    isAnyRunningTask = false
    const totalIdleTime = idleTracker.stopTracking(projectId, taskId);
    screenshotProcessor.stopProcessing();
    activeDuration.stopProcessing();
    urlProcessor.stopProcessing();

    const latestTimeEntry = timeProcessor.getLatestUnfinishedTimeEntry(projectId, taskId);
    if (latestTimeEntry) {
      timeProcessor.updateEndTime(latestTimeEntry.id);
      console.log('latest time entry : ',latestTimeEntry)
    }
    attendanceProcessor.insertAttendanceEnd()
    timeProcessor.stopProcessing()
    attendanceProcessor.startProcessing()
    idleProcessor.stopProcessing()
    configurationProcessor.stopProcessing()
    timeProcessor.processTimeEntries()
    attendanceProcessor.processAttendanceEntries()
    idleProcessor.processIdleEntries()
    activeDuration.processActivities()
    urlProcessor.processActivities()
    screenshotProcessor.processImages()
  } catch (error) {
    console.error('Error stoping idle tracking:', error);
  }
});

