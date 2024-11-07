import { app } from 'electron';
import path from 'path';
import { homedir } from 'os';
import { promises as fs } from 'fs';
const protobuf = require("protobufjs");

interface EdgeActiveTab {
    url: string;
    title: string;
}

interface SNSSEntry {
    type: number;
    data: Buffer;
}

type BufferEncodingType = 'utf8' | 'utf16le' | 'ascii';


function getEdgeProfilePath(): string {
    switch (process.platform) {
        case 'win32': {
            const localAppData = process.env.LOCALAPPDATA ||
                process.env.LOCAL_APPDATA ||
                path.join(process.env.USERPROFILE || homedir(), 'AppData', 'Local');

            return path.join(localAppData, 'Microsoft', 'Edge', 'User Data');
        }
        case 'darwin':
            return path.join(homedir(), 'Library', 'Application Support', 'Microsoft Edge');
        default: // Linux
            return path.join(homedir(), '.config', 'microsoft-edge');
    }
}

async function findLatestSessionFile(sessionsPath: string): Promise<string | null> {
    try {
        const files = await fs.readdir(sessionsPath);
        const sessionFiles = files.filter(file =>
            file.startsWith('Session_') && !file.endsWith('journal')
        );

        if (sessionFiles.length === 0) return null;

        const fileStats = await Promise.all(
            sessionFiles.map(async file => {
                const filePath = path.join(sessionsPath, file);
                const stats = await fs.stat(filePath);
                return { file, filePath, mtime: stats.mtime };
            })
        );

        fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        return fileStats[0].filePath;
    } catch (error) {
        console.error('Error finding latest session file:', error);
        return null;
    }
}

async function readSessionFile(filePath: string): Promise<any> {
    const fileData = await fs.readFile(filePath);
    const textDecoder = new TextDecoder("utf-8");

    // Search for ASCII or UTF-8 strings in the binary file
    let decodedText = "";
    for (let i = 0; i < fileData.length; i++) {
        // Check for readable ASCII characters (rough approach)
        const charCode = fileData[i];
        if (charCode >= 32 && charCode <= 126) {
            decodedText += String.fromCharCode(charCode);
        } else {
            if (decodedText.length > 4) { // Print only meaningful sequences
                // console.log("Found string:", decodedText);
            }
            decodedText = "";
        }
    }
    console.warn("decode", decodedText)
    return decodedText
}

export async function getEdgeActiveTab(): Promise<EdgeActiveTab | null> {
    try {
        const profilePath = getEdgeProfilePath();
        const defaultProfile = path.join(profilePath, 'Default');
        const sessionsPath = path.join(defaultProfile, 'Sessions');

        console.log('Sessions path:', sessionsPath);

        try {
            await fs.access(sessionsPath);
        } catch {
            throw new Error('Edge Sessions directory not found');
        }

        const sessionFile = await findLatestSessionFile(sessionsPath);
        if (!sessionFile) {
            throw new Error('No session files found');
        }

        console.log('Reading session file:', sessionFile);

        const tabData = await readSessionFile(sessionFile);
        let activeTab = null;
        let latestTimestamp = 0;

        for (const data of tabData) {
            if (data.windows) {
                for (const window of data.windows) {
                    if (window.tabs) {
                        for (const tab of window.tabs) {
                            if (tab.active && (!latestTimestamp || tab.timestamp > latestTimestamp)) {
                                latestTimestamp = tab.timestamp;
                                const entries = tab.entries || [];
                                const lastEntry = entries[entries.length - 1] || tab;
                                activeTab = {
                                    url: lastEntry.url,
                                    title: lastEntry.title
                                };
                            }
                        }
                    }
                }
            }
        }

        if (activeTab) {
            console.log('Found active tab:', activeTab);
        } else {
            console.log('No active tab found in the session data');
        }

        return activeTab;

    } catch (error) {
        throw new Error(`Failed to get Edge active tab: ${error.message}`);
    }
}
