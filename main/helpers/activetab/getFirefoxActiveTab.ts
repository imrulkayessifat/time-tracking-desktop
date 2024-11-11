import path from 'path';
import { homedir } from 'os';
import { promises as fs } from 'fs';
import { readFile } from 'fs/promises';

var mozlz4a = require('mozlz4a');

interface FirefoxTab {
    title: string;
    url: string;
    lastAccessed: Date;
    windowId: number;
    tabId: number;
}

function formatDate(date: Date): string {
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function getFirefoxProfilePath() {
    switch (process.platform) {
        case 'win32':
            return path.join(process.env.APPDATA!, 'Mozilla', 'Firefox', 'Profiles');
        case 'darwin':
            return path.join(homedir(), 'Library', 'Application Support', 'Firefox', 'Profiles');
        default: // Linux
            return path.join(homedir(), '.mozilla', 'firefox');
    }
}

async function findDefaultProfile() {
    const profilesPath = getFirefoxProfilePath();
    const profiles = await fs.readdir(profilesPath);
    const defaultProfile = profiles.find(profile =>
        profile.endsWith('.default') || profile.endsWith('.default-release')
    );

    if (!defaultProfile) {
        throw new Error('No default Firefox profile found');
    }
    return path.join(profilesPath, defaultProfile);
}

async function decompressLZ4(compressedData: Buffer): Promise<string> {
    // Verify magic header "mozLz40\0"
    var content = mozlz4a.decompress(compressedData); // returns a Buffer
    var sessions = content.toString('UTF-8')
    return sessions
}




async function readSessionFile(sessionFilePath: string): Promise<FirefoxTab[]> {
    try {
        const compressedData = await readFile(sessionFilePath);
        const decompressedData = await decompressLZ4(compressedData);
        const sessionData = JSON.parse(decompressedData);

        const tabs: FirefoxTab[] = [];

        if (sessionData.windows) {
            sessionData.windows.forEach((window: any) => {
                if (window.tabs) {
                    window.tabs.forEach((tab: any) => {
                        if (tab.entries && tab.entries.length > 0) {
                            const lastEntry = tab.entries[tab.entries.length - 1];
                            tabs.push({
                                title: lastEntry.title || '',
                                url: lastEntry.url || '',
                                lastAccessed: new Date(tab.lastAccessed || 0),
                                windowId: window.id || 0,
                                tabId: tab.id || 0
                            });
                        }
                    });
                }
            });
        }

        return tabs;
    } catch (error) {
        throw new Error(`Failed to read session file: ${error.message}`);
    }
}

export async function readFirefoxTabs(): Promise<FirefoxTab[] | null> {
    try {
        const profilePath = await findDefaultProfile();
        const sessionStorePath = path.join(profilePath, 'sessionstore-backups', 'recovery.jsonlz4');

        try {
            await fs.access(sessionStorePath);
        } catch (error) {
            throw new Error('Firefox session store file not found');
        }

        const tabs = await readSessionFile(sessionStorePath);

        console.log("Tabs found:", tabs.length);
        tabs.forEach(tab => {
            console.log({
                title: tab.title,
                url: tab.url,
                lastAccessed: formatDate(tab.lastAccessed),
                windowId: tab.windowId,
                tabId: tab.tabId
            });
        });

        if (tabs.length > 0) {
            return tabs;
        } else {
            console.log('No open tabs found.');
            return null;
        }
    } catch (error) {
        throw new Error(`Failed to read Firefox tabs: ${error.message}`);
    }
}
