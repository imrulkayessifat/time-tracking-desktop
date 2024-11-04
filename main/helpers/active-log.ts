// const pidusage = require('pidusage');

// import Database from './db';
// import { readFirefoxHistory } from './history/firefox-history';
// import { readChromeHistory } from './history/chrome-history';
// import { readSafariHistory } from './history/safari-history';
// import { readEdgeHistory } from './history/edge-history';

// // Define platform-specific result types
// interface BaseResult {
//     owner: {
//         name: string;
//         processId: number;
//     };
// }

// interface DataType {
//     app_name: string;
//     url: string;
// }

// interface MacResult extends BaseResult {
//     url: string;
// }

// interface WindowsResult extends BaseResult {
//     // Add Windows-specific properties if needed
// }

// interface LinuxResult extends BaseResult {
//     // Add Linux-specific properties if needed
// }

// type Result = MacResult | WindowsResult | LinuxResult;

// // Type guard to check if result is from macOS
// function isMacResult(result: Result): result is MacResult {
//     return process.platform === 'darwin';
// }

// const db = new Database('timetracking.db');

// db.prepare(`
//   CREATE TABLE IF NOT EXISTS activities (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     project_id INTEGER,
//     task_id INTEGER,
//     app_name TEXT,
//     url TEXT,
//     timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
//   )
// `).run();

// const getBrowserHistory = async (name: string) => {
//     const browserName = name.toLowerCase();
//     if (browserName.includes('chrome')) {
//         return await readChromeHistory();
//     } else if (browserName.includes('firefox')) {
//         return await readFirefoxHistory();
//     } else if (browserName.includes('safari')) {
//         return await readSafariHistory();
//     } else if (browserName.includes('edge')) {
//         return await readEdgeHistory();
//     }
//     return null;
// };

// const isBrowser = (appName: string): boolean => {
//     const browsers = ['chrome', 'firefox', 'safari', 'edge'];
//     return browsers.some(browser => appName.toLowerCase().includes(browser));
// };

// const startTracking = async (project_id: number, task_id: number) => {
//     try {
//         const { activeWindow } = await import('../../node_modules/get-windows');
//         const result: Result = await activeWindow();
//         const stats = await pidusage(result.owner.processId)

//         console.log(stats.elapsed)
//         console.log("Active window Start time : ", new Date(Date.now() - stats.elapsed))

//         let data: DataType = {
//             app_name: '',
//             url: ''
//         };
//         const stmt = db.prepare(`
//             INSERT INTO activities (project_id, task_id, app_name, url)
//             VALUES (?, ?, ?, ?)
//           `);
//         data.app_name = result.owner.name
//         if (isBrowser(result.owner.name)) {
//             const browserHistory = await getBrowserHistory(result.owner.name);
//             data.url = browserHistory?.url ?? ''
//         }

//         if (isMacResult(result) && result?.url) {
//             data.url = result?.url ?? ''
//         }
//         stmt.run(project_id, task_id, data.app_name, data.url)
//         console.log("active window log : ", data)
//     } catch (error) {
//         console.error('Error tracking active window:', error);
//     }
// };

// export default startTracking;

import { readFirefoxHistory } from './history/firefox-history';
import { readChromeHistory } from './history/chrome-history';
import { readSafariHistory } from './history/safari-history';
import { readEdgeHistory } from './history/edge-history';

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
    start_time: Date;
    end_time: Date;
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
    const browsers = ['chrome', 'firefox', 'safari', 'edge'];
    return browsers.some(browser => appName.toLowerCase().includes(browser));
};

// Global variable to store the last active window's data
let lastActiveWindow: DataType | null = null;
let inactivityTimeout: NodeJS.Timeout | null = null;

// Timeout duration to determine inactivity (e.g., 2 seconds)
const INACTIVITY_DURATION = 2000;


const getLocalTime = (): Date => {
    // Create a new Date object for the current local time
    const currentUtcTime = new Date();
    const localTimeOffset = currentUtcTime.getTimezoneOffset() * 60000; // Convert offset to milliseconds
    return new Date(currentUtcTime.getTime() - localTimeOffset);
};

const startTracking = async (project_id: number, task_id: number) => {
    try {
        const { activeWindow } = await import('../../node_modules/get-windows');
        const result: Result = await activeWindow();
        const currentTime = getLocalTime();;

        // Check if this window is different from the last tracked one
        if (!lastActiveWindow || lastActiveWindow.app_name !== result.owner.name) {
            if (lastActiveWindow) {
                // Update the end_time of the previous window when a new window is detected
                lastActiveWindow.end_time = currentTime;
                console.log("Previous active window log:", lastActiveWindow);
            }

            // Initialize new active window data
            let newWindow: DataType = {
                app_name: result.owner.name,
                url: '',
                start_time: currentTime, // New window's start_time is the current time
                end_time: new Date() // Initialize end_time as start_time; will update when a new window is detected
            };

            // Check if the current window is a browser and get its history
            if (isBrowser(result.owner.name)) {
                const browserHistory = await getBrowserHistory(result.owner.name);
                newWindow.url = browserHistory?.url ?? '';
            }

            if (isMacResult(result) && result?.url) {
                newWindow.url = result.url ?? '';
            }

            // Set the new active window as the lastActiveWindow
            lastActiveWindow = newWindow;
        }
        if (inactivityTimeout) {
            clearTimeout(inactivityTimeout);
        }

        // Set a new timeout to log the current active window when tracking stops
        inactivityTimeout = setTimeout(() => {
            if (lastActiveWindow) {
                lastActiveWindow.end_time = new Date();
                console.log("Tracking stopped, final active window log:", lastActiveWindow);
                lastActiveWindow = null; // Reset after logging
            }
        }, INACTIVITY_DURATION);

    } catch (error) {
        console.error('Error tracking active window:', error);
    }
};

export default startTracking;
