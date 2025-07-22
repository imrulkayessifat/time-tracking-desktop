import { app } from 'electron';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getLocalTime } from './lib/getLocalTime';

import Database from './db';
import path from 'path';

const execAsync = promisify(exec);

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


// Timeout durations
const INACTIVITY_DURATION = 2000;


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
                    console.log('Failed to remove hidden attribute:', error);
                }
            }
        }
    } catch (error) {
        console.error('Error ensuring directory exists:', error);
        throw error;
    }
};

const startDurationTracking = async (project_id: number, task_id: number) => {
    try {
        const getActiveWindow = (await import('active-win')).default;
        const result: Result = await getActiveWindow({
            accessibilityPermission: false,
            screenRecordingPermission: false
        });

        const dbDir = path.join(app.getPath('userData'), 'db');
        await ensureDirectoryExists(dbDir);
        const dbPath = path.join(dbDir, 'activeduration.db');

        // Initialize database with the correct path
        const db = new Database(dbPath);

        // Create activities table if it doesn't exist
        db.prepare(`
            CREATE TABLE IF NOT EXISTS activeduration (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                task_id INTEGER,
                app_name TEXT,
                start_time TEXT,
                end_time TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
        const stmt = db.prepare(`
            INSERT INTO activeduration (project_id, task_id, app_name,start_time,end_time)
            VALUES (?, ?, ?, ?, ?)
        `);
        const currentTime = getLocalTime();

        // Check if window has changed (either different app or different URL)
        if (!lastActiveWindow || lastActiveWindow.app_name !== result.owner.name) {

            if (lastActiveWindow) {
                // Update the end_time of the previous window when a new window is detected
                lastActiveWindow.end_time = currentTime;

                const payload = {
                    project_id: lastActiveWindow.project_id,
                    app_name: lastActiveWindow.app_name,
                    start_time: lastActiveWindow.start_time,
                    end_time: lastActiveWindow.end_time,
                    task_id: lastActiveWindow.task_id,
                };
                console.log("active duration inserted : ", payload)
                stmt.run(lastActiveWindow.project_id, lastActiveWindow.task_id, lastActiveWindow.app_name, lastActiveWindow.start_time, lastActiveWindow.end_time);
            }

            // Initialize new active window data
            lastActiveWindow = {
                project_id,
                task_id,
                app_name: result.owner.name,
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
                    start_time: lastActiveWindow.start_time,
                    end_time: lastActiveWindow.end_time,
                    task_id: lastActiveWindow.task_id,
                };
                console.log("active duration inserted : ", payload)
                stmt.run(lastActiveWindow.project_id, lastActiveWindow.task_id, lastActiveWindow.app_name, lastActiveWindow.start_time, lastActiveWindow.end_time);
                lastActiveWindow = null;
            }
        }, INACTIVITY_DURATION);

    } catch (error) {
        console.error('Error tracking duration active duration:', error);
    }
};

export default startDurationTracking;