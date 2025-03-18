import path from 'path'
import log from 'electron-log';
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
import { IdleTimeProcessor } from './helpers/processor/idletime-processor';
import { ActiveDurationProcessor } from './helpers/processor/activeduration-processor';
import { UrlProcessor } from './helpers/processor/url-processor';
import { ConfigurationProcessor } from './helpers/processor/configuration-processor'

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
let idleProcessor: IdleTimeProcessor;
let configurationProcessor: ConfigurationProcessor;
// let apiEndpoint: string = "https://timetracker.flytesolutions.com/api/v1";
let apiEndpoint: string = "https://api.stafftimetrack.com/api/v1"
let intervalMs: number = 120000;

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

function extractISOTime(shutdownStr) {
  const match = shutdownStr.match(/\b(\w{3}) (\w{3}) (\d{1,2}) (\d{2}:\d{2})\b/);
  if (!match) return null;

  const [, , monthStr, day, time] = match;
  const year = new Date().getFullYear(); // Use current year

  const months = {
    "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06",
    "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12"
  };

  const month = months[monthStr];
  if (!month) return null;

  const isoDate = `${year}-${month}-${day.padStart(2, '0')}T${time}:00Z`;
  return isoDate;
}

function getLastShutdownTime(callback) {

  let command = "";

  if (process.platform === "linux") {
    command = `last -x | grep shutdown | head -n 1`;
  } else if (process.platform === "win32") {
    command = `wevtutil qe System "/q:*[System[(EventID=1074)]]" /rd:true /c:1 /f:text`;
  } else if (process.platform === "darwin") {
    command = `sysctl kern.boottime`;
  } else {
    return callback("Unsupported OS");
  }

  exec(command, (error, stdout, stderr) => {
    if (error || stderr) {
      callback("Error retrieving shutdown time");
      return;
    }
    if (process.platform === "win32") {
      // Extract just the Date property from Windows event log
      const dateMatch = stdout.match(/Date:\s*([^\r\n]+)/);
      if (dateMatch && dateMatch[1]) {
        callback(dateMatch[1].trim());
      } else {
        callback("Date not found in event log");
      }
    } else if (process.platform === "linux") {
      // Linux format is typically: "shutdown system down 5.4-generic Mon Mar 16 15:30:01 2025"
      // Extract just the date/time portion
      const linuxMatch = extractISOTime(stdout);
      if (linuxMatch) {
        callback(linuxMatch.trim());
      } else {
        callback("Date not found in Linux shutdown log");
      }
    } else if (process.platform === "darwin") {
      // macOS format varies, but we'll extract the timestamp
      // Example: "2025-03-16 14:23:45.123 Previous shutdown cause: 5"

      const dateMatch = stdout.match(/[A-Za-z]{3} [A-Za-z]{3} \d{1,2} \d{2}:\d{2}:\d{2} \d{4}/);

      if (dateMatch) {
        console.log(dateMatch[0]); // Output: Tue Mar 18 13:32:57 2025
        const date = new Date(dateMatch[0] + " UTC"); // Add UTC to avoid timezone issues
        const isoFormat = date.toISOString();
        callback(isoFormat)
      } else {
        callback("Date not found in macOS shutdown log");
      }
    } else {
      callback(stdout.trim());
    }
  });
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
  // globalShortcut.register('CommandOrControl+Shift+I', () => {
  //   mainWindow.webContents.toggleDevTools();
  // });

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
      deleteLogFile();
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

  idleProcessor = new IdleTimeProcessor(`${apiEndpoint}/idle-time-entry`, 30000)
  await idleProcessor.waitForInitialization()

  configurationProcessor = new ConfigurationProcessor(`${apiEndpoint}/init-system`)
  idleTracker = new TaskIdleTracker(`${apiEndpoint}/idle-time-entry`, 10);

  if (process.platform === 'darwin') {
    await getSafariActiveUrl()
    await getChromeBasedBrowserUrl()
  }

  getLastShutdownTime((shutdownTime) => {
    console.log("Last Shutdown Time : ", shutdownTime)
    if(shutdownTime) {
      const lastEntry = timeProcessor.getLastUnfinishedTimeEntryFUS()
      if (lastEntry) {
        timeProcessor.updateEndTime(lastEntry.id,shutdownTime);
      }
    }
  })

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
  console.error("interval", interval, info.minutes, info.seconds, isUrlTracking)

  if (((info.minutes % interval === 0) && info.seconds === 0) || (info.minutes == 0 && info.seconds === 0)) {
    if (info.project_id !== -1) {
      captureAndSaveScreenshot(info);
    }
  }

  startDurationTracking(info.project_id, info.selectedTaskId)
  if (isUrlTracking && (info.seconds % 5 === 0)) {
    startUrlTracking(info.project_id, info.selectedTaskId)
  }
});

ipcMain.on('idle-started', (_, { projectId, taskId }) => {
  try {
    isAnyRunningTask = true
    const timeEntryId = timeProcessor.insertStartTime(projectId, taskId);
    idleTracker.startTracking(projectId, taskId);
    screenshotProcessor.startProcessing();
    activeDuration.startProcessing()
    urlProcessor.startProcessing()
    configurationProcessor.startProcessing();
    timeProcessor.startProcessing()
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
    }
    timeProcessor.stopProcessing()
    idleProcessor.stopProcessing()
    configurationProcessor.stopProcessing()
    timeProcessor.processTimeEntries()
    idleProcessor.processIdleEntries()
    activeDuration.processActivities()
    urlProcessor.processActivities()
    screenshotProcessor.processImages()
  } catch (error) {
    console.error('Error stoping idle tracking:', error);
  }
});

