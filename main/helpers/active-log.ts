import Database from './db';
import { readFirefoxHistory } from './history/firefox-history';
import { readChromeHistory } from './history/chrome-history';
import { readSafariHistory } from './history/safari-history';
import { readEdgeHistory } from './history/edge-history';

// Define platform-specific result types
interface BaseResult {
    owner: {
        name: string;
    };
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

const db = new Database('timetracking.db');

db.prepare(`
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name TEXT,
    url TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

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

const startTracking = async () => {
    try {
        const { activeWindow } = await import('../../node_modules/get-windows');
        const result: Result = await activeWindow();
        const stmt = db.prepare('INSERT INTO activities (app_name, url) VALUES (?, ?)');

        if (isMacResult(result)) {
            // On macOS, we have direct access to the URL
            stmt.run(result.owner.name, result.url);
        } else if (isBrowser(result.owner.name)) {
            // For other platforms, get URL from browser history
            const browserHistory = await getBrowserHistory(result.owner.name);
            console.log(`${result.owner.name} history:`, browserHistory);
            stmt.run(result.owner.name, browserHistory?.[0]?.url ?? '');
        } else {
            // For non-browser applications
            console.log(`${result.owner.name} history:`, result);
            stmt.run(result.owner.name, '');
        }
    } catch (error) {
        console.error('Error tracking active window:', error);
    }
};

export default startTracking;