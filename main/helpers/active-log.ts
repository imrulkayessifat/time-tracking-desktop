import path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

import Database from './db';
import { readFirefoxHistory } from './history/firefox-history';
import { readChromeHistory } from './history/chrome-history';
import { readSafariHistory } from './history/safari-history';
import { readEdgeHistory } from './history/edge-history';

const execAsync = promisify(exec);

// Define platform-specific result types
interface BaseResult {
    owner: {
        name: string;
        processId: number;
    };
}

interface DataType {
    app_name: string;
    url: string;
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

// Type guard to check if result is from macOS
function isMacResult(result: Result): result is MacResult {
    return process.platform === 'darwin';
}

const getBrowserHistory = async (name: string) => {
    const browserName = name.toLowerCase();
    if (browserName.includes('chrome')) {
        return await readChromeHistory();
    } else if (browserName.includes('firefox')) {
        return await readFirefoxHistory();
    } else if (browserName.includes('safari')) {
        return await readSafariHistory();
    } else if (browserName.includes('edge')) {
        return await readEdgeHistory();
    }
    return null;
};

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

const startTracking = async (project_id: number, task_id: number) => {
    try {
        // Ensure db directory exists and get the database path
        const dbDir = path.join(app.getPath('userData'), 'db');
        await ensureDirectoryExists(dbDir);
        const dbPath = path.join(dbDir, 'activitytracking.db');

        // Initialize database with the correct path
        const db = new Database(dbPath);

        // Create activities table if it doesn't exist
        db.prepare(`
            CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                task_id INTEGER,
                app_name TEXT,
                url TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        const getActiveWindow = (await import('active-win')).default;
        const result: Result = await getActiveWindow({
            accessibilityPermission: false,
            screenRecordingPermission: false
        });

        let data: DataType = {
            app_name: '',
            url: ''
        };

        const stmt = db.prepare(`
            INSERT INTO activities (project_id, task_id, app_name, url)
            VALUES (?, ?, ?, ?)
        `);

        data.app_name = result.owner.name;

        if (isBrowser(result.owner.name)) {
            const browserHistory = await getBrowserHistory(result.owner.name);
            data.url = browserHistory?.url ?? '';
        }

        if (isMacResult(result) && result?.url) {
            data.url = result?.url ?? '';
        }

        const info = stmt.run(project_id, task_id, data.app_name, data.url);

        if (info) {
            console.log("Activity inserted successfully");
            console.log("Active window data:", data);
        } else {
            console.error("Failed to insert activity - no database response");
        }

    } catch (error) {
        console.error('Error tracking active window:', error);
        throw error;
    }
};

export default startTracking;