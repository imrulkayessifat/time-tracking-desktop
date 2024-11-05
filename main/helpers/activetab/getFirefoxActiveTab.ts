import { app } from 'electron';
import path from 'path';
import { homedir } from 'os';
import { promises as fs } from 'fs';
import { copyFile } from 'fs/promises';
const { uncompress } = require('lz4-napi');

interface FirefoxTab {
    url: string;
    title: string;
    lastAccessed: number;
    isActive: boolean;
}

// Helper functions remain the same
async function findDefaultProfile() {
    const profilesPath = await getFirefoxProfilePath();
    const profiles = await fs.readdir(profilesPath);
    const defaultProfile = profiles.find(profile =>
        profile.endsWith('.default') || profile.endsWith('.default-release')
    );

    if (!defaultProfile) {
        throw new Error('No default Firefox profile found');
    }
    return path.join(profilesPath, defaultProfile);
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

async function copySessionFile(sessionPath: string): Promise<string> {
    const timestamp = Date.now();
    const tempPath = path.join(app.getPath('temp'), `recovery-${timestamp}.jsonlz4`);
    await copyFile(sessionPath, tempPath);
    return tempPath;
}

async function decompressLz4File(inputPath: string): Promise<Buffer> {
    // Read the compressed file
    const compressedData = await fs.readFile(inputPath);

    if (!Buffer.isBuffer(compressedData)) {
        throw new Error('Invalid input: Expected Buffer');
    }

    // Firefox's LZ4 files start with a magic number "mozLz40\0" (8 bytes)
    const header = compressedData.slice(0, 8).toString();

    // Debug logging
    console.log('File size:', compressedData.length);
    console.log('Header:', header);
    console.log('Header bytes:', Array.from(compressedData.slice(0, 8)));

    if (header !== 'mozLz40\0') {
        throw new Error('Invalid Firefox session file format');
    }

    // Skip the 8-byte header
    const withoutHeader = compressedData.slice(8);

    // First 4 bytes contain the original size (little-endian)
    const originalSize = withoutHeader.readUInt32LE(0);
    console.log('Original size:', originalSize);

    // Get the actual compressed data (skip first 4 bytes containing size)
    const compressedBuffer = withoutHeader.slice(4);

    try {

        // Call uncompress with explicit Buffer types
        const decompressed = await uncompress(compressedBuffer);

        // Debug: Log the first few bytes of decompressed data
        console.log('First 100 bytes of decompressed data:',
            decompressed.slice(0, 100).toString('hex'));
        console.log('First 100 chars of decompressed string:',
            decompressed.slice(0, 100).toString('utf8'));

        return decompressed;
    } catch (error) {
        console.error('Decompression error details:', error);
        throw new Error(`Decompression failed: ${error.message}`);
    }
}

export async function getFirefoxActiveTab(): Promise<FirefoxTab | null> {
    try {
        const profilePath = await findDefaultProfile();
        const sessionStorePath = path.join(profilePath, 'sessionstore-backups', 'recovery.jsonlz4');

        console.log('Session file path:', sessionStorePath);

        // Check if session file exists
        try {
            await fs.access(sessionStorePath);
        } catch (error) {
            throw new Error(`Firefox session file not found: ${sessionStorePath}`);
        }

        // Create a temporary copy of the session file
        const tempSessionPath = await copySessionFile(sessionStorePath);
        console.log('Temporary session file created at:', tempSessionPath);

        try {
            // Decompress the session file
            const decompressedData = await decompressLz4File(tempSessionPath);

            if (!decompressedData || !Buffer.isBuffer(decompressedData)) {
                throw new Error('Invalid decompressed data format');
            }

            let sessionData;
            try {
                // Try different encodings if UTF-8 fails
                const encodings = ['utf8', 'utf16le', 'latin1'];
                let jsonString = '';
                let validJson = false;

                for (const encoding of encodings) {
                    try {
                        jsonString = decompressedData.toString(encoding as BufferEncoding);
                        // Test if it's valid JSON
                        JSON.parse(jsonString);
                        validJson = true;
                        console.log(`Successfully parsed using ${encoding} encoding`);
                        break;
                    } catch (e) {
                        console.log(`Failed to parse with ${encoding} encoding:`, e.message);
                        continue;
                    }
                }

                if (!validJson) {
                    // If all encodings fail, try to clean the string
                    jsonString = decompressedData.toString('utf8')
                        .replace(/^\uFEFF/, '') // Remove BOM if present
                        .trim();

                    // Log the start of the string for debugging
                    console.log('Clean JSON string start:', jsonString.substring(0, 100));

                    sessionData = JSON.parse(jsonString);
                } else {
                    sessionData = JSON.parse(jsonString);
                }
            } catch (error) {
                console.error('JSON Parse Error:', error);
                console.log('Decompressed data length:', decompressedData.length);
                throw new Error(`Failed to parse session data: ${error.message}`);
            }

            if (!sessionData?.windows?.length) {
                throw new Error('No windows found in session data');
            }

            // Find the most recently active window
            const activeWindow = sessionData.windows.reduce((latest: any, current: any) => {
                return (!latest || current.lastAccessed > latest.lastAccessed) ? current : latest;
            }, null);

            if (!activeWindow?.tabs?.length) {
                return null;
            }

            // Find the active tab in the most recent window
            const activeTab = activeWindow.tabs.find((tab: any) => tab.active);

            if (!activeTab?.entries?.length || !activeTab.index) {
                return null;
            }

            // Get the most recent entry in the tab's history
            const currentEntry = activeTab.entries[activeTab.index - 1];

            if (!currentEntry?.url || !currentEntry?.title) {
                return null;
            }

            return {
                url: currentEntry.url,
                title: currentEntry.title,
                lastAccessed: activeTab.lastAccessed || Date.now(),
                isActive: true
            };
        } finally {
            // Clean up temporary file
            try {
                await fs.unlink(tempSessionPath);
            } catch (error) {
                console.error('Failed to cleanup temporary session file:', error);
            }
        }
    } catch (error) {
        console.error('Firefox active tab error:', error);
        throw new Error(`Failed to read Firefox active tab: ${error.message}`);
    }
}