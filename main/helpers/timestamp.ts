// src/helpers/timestamp.ts
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getLocalTime } from './lib/getLocalTime';

const timestampPath = path.join(app.getPath('userData'), 'lastCloseTime.json');

export function updateTimestamp() {
    const timestamp = getLocalTime();
    const tempPath = timestampPath + '.tmp';
    const backupPath = timestampPath + '.backup';

    try {
        // Write the new data to a temporary file first
        fs.writeFileSync(tempPath, JSON.stringify({
            lastCloseTime: timestamp,
            version: Date.now() // Add a version number (using timestamp)
        }));

        // If we already have a main file, create a backup before replacement
        if (fs.existsSync(timestampPath)) {
            fs.copyFileSync(timestampPath, backupPath);
        }

        // Then rename the temp file to become the main file
        fs.renameSync(tempPath, timestampPath);

    } catch (error) {
        console.error("Error updating timestamp:", error);
        // Clean up the temp file if it exists
        if (fs.existsSync(tempPath)) {
            try {
                fs.unlinkSync(tempPath);
            } catch (e) {
                console.error("Failed to clean up temp file:", e);
            }
        }
    }
}

export function getLastCloseTime() {
    const files = [
        { path: timestampPath, priority: 1 },
        { path: timestampPath + '.backup', priority: 2 }
    ];

    let bestData = null;
    let highestVersion = -1;

    // Try to read from all possible files and use the highest version
    for (const file of files) {
        try {
            if (fs.existsSync(file.path)) {
                const content = fs.readFileSync(file.path).toString();
                const parsed = JSON.parse(content);

                // Basic validation
                if (!parsed || typeof parsed.lastCloseTime !== 'string') {
                    console.log(`File ${file.path} has invalid format`);
                    continue;
                }

                // Use version if available, otherwise use priority as a fallback
                const version = parsed.version || file.priority;

                // Keep the data with highest version
                if (version > highestVersion) {
                    highestVersion = version;
                    bestData = parsed.lastCloseTime;
                }
            }
        } catch (error) {
            console.error(`Error reading from ${file.path}:`, error);
            // Create backup of corrupted file for debugging
            try {
                fs.copyFileSync(file.path, `${file.path}.corrupted.${Date.now()}`);
            } catch (e) {
                console.error(`Failed to backup corrupted file ${file.path}:`, e);
            }
        }
    }

    return bestData;
}
