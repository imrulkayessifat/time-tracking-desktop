import { app } from 'electron';
import path from 'path';
import { homedir } from 'os';
import { promises as fs } from 'fs';
import { copyFile } from 'fs/promises';
import * as lz4 from 'lz4js';

interface FirefoxActiveTab {
    url: string;
    title: string;
    // last_accessed: number;
}

// Reusing the profile path functions from the original code
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

async function copySessionStoreFiles(filePath: string): Promise<string> {
    const timestamp = Date.now();
    const tempPath = path.join(app.getPath('temp'), `recovery-${timestamp}.jsonlz4`);

    await copyFile(filePath, tempPath);
    return tempPath;
}

async function decompressLZ4(input: Buffer): Promise<Buffer> {
    // Read the uncompressed size from the header (4 bytes, little-endian)
    const uncompressedSize = input.readUInt32LE(0);

    // Create output buffer of the specified size
    const output = Buffer.alloc(uncompressedSize);

    // Get the compressed data (skipping the 4-byte header)
    const compressed = input.slice(4);

    let pos = 0;  // Position in compressed data
    let outPos = 0;  // Position in output buffer

    while (pos < compressed.length) {
        // Read token
        const token = compressed[pos++];

        // Get literal length
        let literalLength = token >> 4;
        if (literalLength === 15) {
            let len;
            do {
                len = compressed[pos++];
                literalLength += len;
            } while (len === 255);
        }

        // Copy literals
        compressed.copy(output, outPos, pos, pos + literalLength);
        pos += literalLength;
        outPos += literalLength;

        if (pos >= compressed.length) break;

        // Get match offset
        const offset = compressed.readUInt16LE(pos);
        pos += 2;

        // Get match length
        let matchLength = token & 0x0F;
        if (matchLength === 15) {
            let len;
            do {
                len = compressed[pos++];
                matchLength += len;
            } while (len === 255);
        }
        matchLength += 4;

        // Copy match
        let matchPos = outPos - offset;
        while (matchLength--) {
            output[outPos++] = output[matchPos++];
        }
    }

    return output;
}

async function readJSONLZ4File(filePath: string): Promise<any> {
    try {
        const data = await fs.readFile(filePath);

        // Check for Mozilla LZ4 magic number
        const magic = data.slice(0, 8);
        const expectedMagic = Buffer.from('mozLz40\0', 'utf8');

        if (!magic.equals(expectedMagic)) {
            throw new Error('invalid magic number');
        }

        // Get the compressed data (skipping 8-byte header)
        const compressed = data.slice(8);

        try {
            // Try custom decompression first
            const decompressed = await decompressLZ4(compressed);
            const jsonString = decompressed.toString('utf8');
            return JSON.parse(jsonString);
        } catch (decompressionError) {
            console.error('Custom decompression failed:', decompressionError);

            // Fallback to lz4js library
            const decompressedSize = compressed.readUInt32LE(0);
            const compressedData = compressed.slice(4);
            const decompressedBuffer = Buffer.alloc(decompressedSize);
            lz4.decompress(compressedData, decompressedBuffer);

            const jsonString = decompressedBuffer.toString('utf8');
            return JSON.parse(jsonString);
        }
    } catch (error) {
        throw new Error(`Failed to read session file: ${error.message}`);
    }
}

export async function getFirefoxActiveTab(): Promise<FirefoxActiveTab | null> {
    try {
        const profilePath = await findDefaultProfile();

        // Firefox stores session information in multiple possible files
        const sessionFiles = [
            // 'sessionstore.jsonlz4',
            'sessionstore-backups/recovery.jsonlz4',
            // 'sessionstore-backups/recovery.baklz4',
            // 'sessionstore-backups/previous.jsonlz4'
        ];

        let sessionData = null;

        // Try each possible session file location
        for (const sessionFile of sessionFiles) {
            const filePath = path.join(profilePath, sessionFile);
            try {
                await fs.access(filePath);
                const tempFilePath = await copySessionStoreFiles(filePath);

                try {
                    sessionData = await readJSONLZ4File(tempFilePath);
                    await fs.unlink(tempFilePath).catch(console.error);
                    console.log(`Successfully read session data from ${sessionFile}`);
                    break;
                } catch (error) {
                    console.error(`Failed to read session file ${sessionFile}:`, error);
                    await fs.unlink(tempFilePath).catch(console.error);
                    continue;
                }

            } catch (error) {
                // File doesn't exist or isn't accessible, try next one
                continue;
            }
        }

        if (!sessionData) {
            throw new Error('No valid session file found');
        }

        const data = sessionData.windows[0].tabs
        const processedData = data.map(item => {
            return {
                entries: item.entries,
                lastAccessed: new Date(item.lastAccessed).toISOString().replace('T', ' ').slice(0, 19),
                storage: item.storage,
                formdata: item.formdata
            };
        });
        processedData.sort((a, b) =>
            new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
        );

        console.log("session", processedData)


        // Find the most recently accessed window
        const activeWindow = sessionData.windows.reduce((latest: any, window: any) => {
            return (!latest || window.lastAccessed > latest.lastAccessed) ? window : latest;
        }, null);

        if (!activeWindow || !activeWindow.tabs) {
            return null;
        }
        const windowForLogging = {

            tabs: activeWindow.tabs.map(tab => {
                const { image, ...tabWithoutImage } = tab;
                return tabWithoutImage;
            })
        };
        windowForLogging.tabs.forEach(tab => {
            if (tab.lastAccessed) {
                tab.lastAccessed = new Date(tab.lastAccessed).toISOString();
            }
        });

        const activeTab = activeWindow.tabs.reduce((latest: any, tab: any) => {
            return (!latest || tab.lastAccessed > latest.lastAccessed) ? tab : latest;
        }, null);

        if (!activeTab || !activeTab.entries || activeTab.entries.length === 0) {
            return null;
        }

        // Get the current entry from the tab
        const currentEntry = activeTab.entries[activeTab.index - 1] || activeTab.entries[activeTab.entries.length - 1];

        // For debugging
        return {
            url: currentEntry.url,
            title: currentEntry.title,
            // last_accessed: activeWindow.lastAccessed
        };

    } catch (error) {
        throw new Error(`Failed to get Firefox active tab: ${error.message}`);
    }
}
