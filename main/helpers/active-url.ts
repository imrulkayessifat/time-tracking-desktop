import { clipboard, app } from 'electron';
var robot = require("@hurdlegroup/robotjs");
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

import Database from './db';
import { getLocalTime } from './lib/getLocalTime';
import path from 'path';

const execAsync = promisify(exec);

// Define platform-specific result types
interface BaseResult {
    owner: {
        name: string;
        processId: number;
    };
}

interface DataType {
    project_id: number;
    task_id: number;
    app_name: string;
    url: string;
    start_time: string;
    end_time: string;
}

interface MacResult extends BaseResult {
    url: string;
}

interface WindowsResult extends BaseResult {
    // Add Windows-specific properties if needed
}

interface LinuxResult extends BaseResult {
    // Add Linux-specific properties if needed
}

type Result = MacResult | WindowsResult | LinuxResult;

// Global variable to store the last active window's data
let lastActiveWindow: DataType | null = null;
let inactivityTimeout: NodeJS.Timeout | null = null;
let lastBrowserUrlCheckTime: number = 0;

// Timeout durations
const INACTIVITY_DURATION = 2000;
const BROWSER_URL_COOLDOWN = 60000;


async function getBrowserUrl() {
    try {
        // Clear the clipboard
        const initialClipboardContent = clipboard.readText();

        clipboard.writeText('');

        // Simulate Ctrl+L to focus the address bar
        robot.keyTap('l', 'control');

        // Wait a bit to ensure the address bar is focused
        await new Promise(resolve => setTimeout(resolve, 100));

        // Simulate Ctrl+C to copy the URL
        robot.keyTap('c', 'control');

        // Wait for the clipboard to be populated
        await new Promise(resolve => setTimeout(resolve, 300));

        // Read the URL from the clipboard
        const url = clipboard.readText().trim();
        console.log("robot : ", url)
        clipboard.writeText(initialClipboardContent);

        // Press Escape key
        robot.keyTap('escape');

        // Validate the URL
        // const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        // const isValidUrl = urlRegex.test(url);

        // console.log(`URL retrieved: ${isValidUrl ? url : 'Invalid URL'}`);

        return {
            url
        };
    } catch (error) {
        console.error('Error retrieving browser URL:', error);
        return null;
    }
}


const isBrowser = (appName: string): boolean => {
    const browsers = ['chrome', 'firefox', 'safari', 'edge', 'opera', 'internet explorer'];
    return browsers.some(browser => appName.toLowerCase().includes(browser));
};

const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
    try {
        // Normalize the path to handle Windows path separators correctly
        const normalizedPath = path.normalize(dirPath);

        // Check if directory exists
        try {
            await fs.promises.access(normalizedPath);
        } catch {
            // Directory doesn't exist, create it
            await fs.promises.mkdir(normalizedPath, { recursive: true });

            // For Windows: Remove hidden attribute and ensure proper permissions
            if (process.platform === 'win32') {
                try {
                    await execAsync(`attrib -h "${normalizedPath}"`);
                } catch (error) {
                    console.warn('Failed to remove hidden attribute:', error);
                }
            }
        }
    } catch (error) {
        console.error('Error ensuring directory exists:', error);
        throw error;
    }
};

const getLocalTimeT = (): Date => {
    const currentUtcTime = new Date();
    const localTimeOffset = currentUtcTime.getTimezoneOffset() * 60000; // Convert offset to milliseconds
    return new Date(currentUtcTime.getTime() - localTimeOffset)
};

const startUrlTracking = async (project_id: number, task_id: number) => {
    try {
        const getActiveWindow = (await import('active-win')).default;
        const result: Result = await getActiveWindow({
            accessibilityPermission: false,
            screenRecordingPermission: false
        });

        const dbDir = path.join(app.getPath('userData'), 'db');
        await ensureDirectoryExists(dbDir);
        const dbPath = path.join(dbDir, 'activeurl.db');

        // Initialize database with the correct path
        const db = new Database(dbPath);

        // Create activities table if it doesn't exist
        db.prepare(`
            CREATE TABLE IF NOT EXISTS activeurl (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                task_id INTEGER,
                url TEXT,
                start_time TEXT,
                end_time TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
        const stmt = db.prepare(`
            INSERT INTO activeurl (project_id, task_id, url,start_time,end_time)
            VALUES (?, ?, ?, ?, ?)
        `);

        const currentTime = getLocalTime();
        const currentTimeT = getLocalTimeT()
        const currentTimeMs = currentTimeT.getTime();

        let currentUrl = '';
        if (isBrowser(result.owner.name)) {
            const isSameBrowser = lastActiveWindow && lastActiveWindow.app_name === result.owner.name;
            const isCooldownExpired = Date.now() - lastBrowserUrlCheckTime >= BROWSER_URL_COOLDOWN;

            if (!lastActiveWindow || !isSameBrowser || isCooldownExpired) {
                const browserHistory = await getBrowserUrl();
                currentUrl = browserHistory?.url ?? '';

                // Update the last check time
                lastBrowserUrlCheckTime = Date.now();
            } else {
                // If within cooldown and same browser, use the last known URL
                currentUrl = lastActiveWindow.url;
            }
        }

        // Check if window has changed (either different app or different URL)
        if (!lastActiveWindow || lastActiveWindow.app_name !== result.owner.name || (currentUrl && lastActiveWindow.url !== currentUrl)) {

            if (lastActiveWindow) {
                // Update the end_time of the previous window when a new window is detected
                lastActiveWindow.end_time = currentTime;

                const payload = {
                    project_id: lastActiveWindow.project_id,
                    app_name: lastActiveWindow.app_name,
                    url: lastActiveWindow.url,
                    start_time: lastActiveWindow.start_time,
                    end_time: lastActiveWindow.end_time,
                    ...(lastActiveWindow.task_id !== -1 && { task_id: lastActiveWindow.task_id })
                };
                console.log("last active url : ", payload)
                if (lastActiveWindow.url.length > 0) {
                    stmt.run(lastActiveWindow.project_id, lastActiveWindow.task_id, lastActiveWindow.url, lastActiveWindow.start_time, lastActiveWindow.end_time);
                }
            }

            // Initialize new active window data
            lastActiveWindow = {
                project_id,
                task_id,
                app_name: result.owner.name,
                url: currentUrl,
                start_time: currentTime,
                end_time: currentTime
            };
        }

        if (inactivityTimeout) {
            clearTimeout(inactivityTimeout);
        }

        // Set a new timeout to log the current active window when tracking stops
        inactivityTimeout = setTimeout(async () => {
            if (lastActiveWindow) {
                lastActiveWindow.end_time = currentTime;
                const payload = {
                    project_id: lastActiveWindow.project_id,
                    app_name: lastActiveWindow.app_name,
                    url: lastActiveWindow.url,
                    start_time: lastActiveWindow.start_time,
                    end_time: lastActiveWindow.end_time,
                    ...(lastActiveWindow.task_id !== -1 && { task_id: lastActiveWindow.task_id })
                };

                console.log("final active url :", payload);
                if (lastActiveWindow.url.length > 0) {
                    stmt.run(lastActiveWindow.project_id, lastActiveWindow.task_id, lastActiveWindow.url, lastActiveWindow.start_time, lastActiveWindow.end_time);
                }
                lastActiveWindow = null;
            }
        }, INACTIVITY_DURATION);

    } catch (error) {
        console.error('Error tracking duration active url:',error);
    }
};

export default startUrlTracking;