import path from 'path';
import { homedir } from 'os';
import { Level } from 'level';
import fs from 'fs/promises';
import { app } from 'electron'; // Assumes you are in an Electron environment

interface EdgeTab {
    title: string;
    url: string;
    lastAccessed: Date;
    windowId: number;
    tabId: number;
}

function getEdgeLevelDBPath(): string {
    switch (process.platform) {
        case 'win32':
            return path.join(process.env.LOCALAPPDATA!, 'Microsoft', 'Edge', 'User Data', 'Default', 'Local Storage', 'leveldb');
        case 'darwin':
            return path.join(homedir(), 'Library', 'Application Support', 'Microsoft Edge', 'Default', 'Local Storage', 'leveldb');
        default: // Linux
            return path.join(homedir(), '.config', 'microsoft-edge', 'Default', 'Local Storage', 'leveldb');
    }
}

async function createTemporaryDbCopy(originalDbPath: string): Promise<string> {
    // Generate timestamp-based path for the temp copy
    const timestamp = Date.now();
    const tempBasePath = path.join(app.getPath('temp'), `places-${timestamp}`);
    const tempDbPath = `${tempBasePath}`;

    // Copy the original database directory to the temporary path
    await fs.cp(originalDbPath, tempDbPath, { recursive: true });
    return tempDbPath;
}

export async function readEdgeTabs(): Promise<EdgeTab[]> {
    const originalDbPath = getEdgeLevelDBPath();
    const tabs: EdgeTab[] = [];
    let tempDbPath: string | undefined;

    try {
        // Step 1: Create a temporary copy of the Edge LevelDB database
        tempDbPath = await createTemporaryDbCopy(originalDbPath);

        // Step 2: Open the temporary database and read entries
        const db = new Level<string, string>(tempDbPath, {
            createIfMissing: false,
            errorIfExists: false,
        });

        try {
            for await (const [key, value] of db.iterator()) {
                try {
                    const keyString = key.toString();

                    console.log("key string : ", keyString)
                    // Look for tab-related entries
                    // if (keyString.includes('_tabs') || keyString.includes('sessions')) {
                    //     const data = JSON.parse(value.toString());
                    //     console.log("data : ", data)
                    //     // Handle different data structures that might contain tab information
                    //     if (data.tabs) {
                    //         data.tabs.forEach((tab: any) => {
                    //             if (tab.url && tab.title) {
                    //                 tabs.push({
                    //                     title: tab.title,
                    //                     url: tab.url,
                    //                     lastAccessed: new Date(tab.last_accessed_time || Date.now()),
                    //                     windowId: tab.window_id || 0,
                    //                     tabId: tab.id || 0
                    //                 });
                    //             }
                    //         });
                    //     }
                    // }
                } catch (parseError) {
                    // Skip entries that can't be parsed
                    continue;
                }
            }
        } finally {
            await db.close();
        }

    } catch (error) {
        throw new Error(`Failed to read Edge tabs: ${error.message}`);
    } finally {
        // Step 3: Clean up by deleting the temporary database copy
        if (tempDbPath) {
            await fs.rm(tempDbPath, { recursive: true, force: true });
        }
    }

    console.log("tabs : ", tabs)

    return tabs;
}
