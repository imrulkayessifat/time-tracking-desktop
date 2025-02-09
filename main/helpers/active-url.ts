import { app } from 'electron';
import * as fs from 'fs';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
const { spawn } = require("child_process");

import { readFirefoxHistory } from './history/firefox-history';
import { readChromeHistory } from './history/chrome-history';
import { readSafariHistory } from './history/safari-history';
import { readEdgeHistory } from './history/edge-history';


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
    url?: string;
}

interface LinuxResult extends BaseResult {
    // Add Linux-specific properties if needed
    url?: string;
}

type Result = MacResult | WindowsResult | LinuxResult;

// Global variable to store the last active window's data
let lastActiveWindow: DataType | null = null;
let inactivityTimeout: NodeJS.Timeout | null = null;

// Timeout durations
const INACTIVITY_DURATION = 2000;

const isBrowser = (appName: string): boolean => {
    const browsers = ['google chrome', 'firefox', 'safari', 'edge', 'opera', 'internet explorer'];
    return browsers.some(browser => appName.toLowerCase().includes(browser));
};
const isProd = process.env.NODE_ENV === 'production'

const getBrowserHistory = async (name: string) => {
    const browserName = name.toLowerCase();

    if (browserName.includes('google chrome')) {
        return new Promise<string>((resolve, reject) => {
            let scriptPath
            if (isProd) {
                const parentDir = path.dirname(path.dirname(path.dirname(__dirname)))
                scriptPath = path.join(parentDir, 'scripts/chrome.exe')
            } else {
                scriptPath = path.join(__dirname, '../scripts/chrome.exe')
            }
            const chromeProcess = execFile(scriptPath);

            let dataOutput = '';

            chromeProcess.stdout.on("data", (data) => {
                dataOutput = data.toString().trim(); // Collect the data
            });

            chromeProcess.stderr.on("data", (data) => {
                console.error("stderr: ", data.toString());
            });

            chromeProcess.on("close", (code) => {
                if (code !== 0) {
                    console.error(`python process exited with code ${code}`);
                    reject(`Error with chrome process (code ${code})`);
                } else {
                    console.log('python process completed successfully');
                    resolve(dataOutput); // Resolve with the accumulated output
                }
            });
        });
    } else if (browserName.includes('firefox')) {
        return new Promise<string>((resolve, reject) => {
            let scriptPath
            if (isProd) {
                const parentDir = path.dirname(path.dirname(path.dirname(__dirname)))
                scriptPath = path.join(parentDir, 'scripts/firefox.exe')
            } else {
                scriptPath = path.join(__dirname, '../scripts/firefox.exe')
            }
            const firefoxProcess = execFile(scriptPath);

            let dataOutput = '';

            firefoxProcess.stdout.on("data", (data) => {
                dataOutput = data.toString().trim(); // Collect the data
            });

            firefoxProcess.stderr.on("data", (data) => {
                console.error("stderr: ", data.toString());
            });

            firefoxProcess.on("close", (code) => {
                if (code !== 0) {
                    console.error(`python process exited with code ${code}`);
                    reject(`Error with firefox process (code ${code})`);
                } else {
                    console.log('python process completed successfully');
                    resolve(dataOutput); // Resolve with the accumulated output
                }
            });
        });
    }
    return null;
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

        let currentUrl = '';
        if (isBrowser(result.owner.name)) {
            if (process.platform === 'darwin') {
                currentUrl = result.url
            } else if (process.platform === 'win32') {
                const browserHistory = await getBrowserHistory(result.owner.name);
                console.log("url : ", browserHistory)
                currentUrl = browserHistory
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
        console.error('Error tracking duration active url:', error);
    }
};

export default startUrlTracking;