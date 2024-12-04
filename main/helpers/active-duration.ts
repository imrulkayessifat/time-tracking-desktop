import { clipboard } from 'electron';
var robot = require("@hurdlegroup/robotjs");
import { readFirefoxTabs } from './activetab/getFirefoxActiveTab';
import { getChromeAllTabs } from './activetab/getChromeActiveTab';
import { readSafariHistory } from './history/safari-history';
import { readEdgeTabs } from './activetab/getEdgeActiveTab';

import AuthTokenStore from './auth-token-store';

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
        return await getChromeAllTabs();
    } else if (browserName.includes('firefox')) {
        return await readFirefoxTabs();
    } else if (browserName.includes('safari')) {
        return await readSafariHistory();
    } else if (browserName.includes('edge')) {
        return await readEdgeTabs();
    }
    return null;
};

const getAuthHeaders = (): Headers => {
    const headers = new Headers({
        'Content-Type': 'application/json'
    });

    const tokenStore = AuthTokenStore.getInstance();
    const token = tokenStore.getToken();

    if (token) {
        headers.append('Authorization', `${token}`);
    }

    return headers;
}

// Global variable to store the last active window's data
let lastActiveWindow: DataType | null = null;
let inactivityTimeout: NodeJS.Timeout | null = null;
let lastBrowserUrlCheckTime: number = 0;

// Timeout durations
const INACTIVITY_DURATION = 2000;
const BROWSER_URL_COOLDOWN = 60000;


const getLocalTime = (): Date => {
    // Create a new Date object for the current local time
    const currentUtcTime = new Date();
    const localTimeOffset = currentUtcTime.getTimezoneOffset() * 60000; // Convert offset to milliseconds
    return new Date(currentUtcTime.getTime() - localTimeOffset);
};

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

const startDurationTracking = async (project_id: number, task_id: number, apiEndpoint: string) => {
    try {
        const getActiveWindow = (await import('active-win')).default;
        const result: Result = await getActiveWindow({
            accessibilityPermission: false,
            screenRecordingPermission: false
        });
        const currentTime = getLocalTime();
        const currentTimeMs = currentTime.getTime();

        let currentUrl = '';
        if (isBrowser(result.owner.name)) {
            const isSameBrowser = lastActiveWindow && lastActiveWindow.app_name === result.owner.name;
            const isCooldownExpired = currentTimeMs - lastBrowserUrlCheckTime >= BROWSER_URL_COOLDOWN;

            if (!lastActiveWindow || !isSameBrowser || isCooldownExpired) {
                const browserHistory = await getBrowserUrl();
                currentUrl = browserHistory?.url ?? '';
                
                // Update the last check time
                lastBrowserUrlCheckTime = currentTimeMs;
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
                console.log("last active window : ", payload)

                // Uncomment when ready to send data
                const response = await fetch(`${apiEndpoint}/activity/app-usages`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        data: [

                            payload

                        ]
                    })
                });
                const data = await response.json()
                console.log("Previous active window log:", data);
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

                console.log("final active window :", payload);

                // Uncomment when ready to send data
                const response = await fetch(`${apiEndpoint}/activity/app-usages`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        data: [

                            payload

                        ]
                    })
                });
                const data = await response.json()
                console.log("Tracking stopped, final active window duration log:", data);
                lastActiveWindow = null;
            }
        }, INACTIVITY_DURATION);

    } catch (error) {
        console.error('Error tracking duration active window:');
    }
};

export default startDurationTracking;