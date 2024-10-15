import path from 'path'
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  MenuItemConstructorOptions,
  Tray,
  desktopCapturer,
  screen
} from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'

const isProd = process.env.NODE_ENV === 'production'

import * as fs from 'fs';

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let contextMenu: Menu | null = null;
let lastScreenshotTime = { minutes: -1, hours: -1 };

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
    mainWindow.setSize(newWidth, height);
  }
});

ipcMain.on('timer-status-update', (_, isRunning: boolean) => {
  rebuildTrayMenu(isRunning);
});

ipcMain.on('timer-update', (_, time: { hours: number, minutes: number, seconds: number }) => {
  if (time.minutes !== lastScreenshotTime.minutes || time.hours !== lastScreenshotTime.hours) {
    captureAndSaveScreenshot(time);
    lastScreenshotTime = { minutes: time.minutes, hours: time.hours };
  }
});

const captureAndSaveScreenshot = async (time: { hours: number, minutes: number, seconds: number }) => {
  try {

    const displays = screen.getAllDisplays();
    const screenshotPath = path.join(app.getPath('pictures'), 'ASD_Screenshots');

    if (!fs.existsSync(screenshotPath)) {
      fs.mkdirSync(screenshotPath, { recursive: true });
    }

    for (let i = 0; i < displays.length; i++) {
      const display = displays[i];
      const { bounds } = display;

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: bounds.width, height: bounds.height }
      });

      const source = sources.find(s =>
        s.display_id === display.id.toString() ||
        (s.id.startsWith('screen:') && sources.length === 1)
      );

      if (source && source.thumbnail) {
        const fileName = `screenshot_display${i + 1}_${time.hours.toString().padStart(2, '0')}-${time.minutes.toString().padStart(2, '0')}-${time.seconds.toString().padStart(2, '0')}.png`;
        const filePath = path.join(screenshotPath, fileName);

        fs.writeFileSync(filePath, source.thumbnail.toPNG());
        console.log(`Screenshot saved for display ${i + 1}: ${filePath}`);
      } else {
        console.error(`No source found for display ${i + 1}`);
      }
    }
  } catch (error) {
    console.error('Error capturing screenshot:', error);
  }
};
