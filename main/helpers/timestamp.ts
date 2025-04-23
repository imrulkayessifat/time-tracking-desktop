import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getLocalTime } from './lib/getLocalTime';

const timestampDirectory = path.join(app.getPath('userData'), 'timestamps');

// Ensure the timestamps directory exists
function ensureDirectoryExists() {
    if (!fs.existsSync(timestampDirectory)) {
        fs.mkdirSync(timestampDirectory, { recursive: true });
    }
}

// Get all timestamp files in the directory
function getTimestampFiles() {
    ensureDirectoryExists();
    return fs.readdirSync(timestampDirectory)
        .filter(file => file.startsWith('timestamp_'))
        .map(file => path.join(timestampDirectory, file))
        .sort();
}

export function updateTimestamp() {
    const timestamp = getLocalTime();
    const formattedTimestamp = timestamp.replace(/[: ]/g, '_');
    const newFilePath = path.join(timestampDirectory, `timestamp_${formattedTimestamp}.json`);

    ensureDirectoryExists();

    try {
        // Write the new timestamp file (with or without content)

        // Create an empty file
        fs.writeFileSync(newFilePath, '');


        // Get all existing timestamp files
        const existingFiles = getTimestampFiles();

        // Remove all except the newest file (which we just created)
        existingFiles.forEach(file => {
            if (file !== newFilePath) {
                try {
                    fs.unlinkSync(file);
                } catch (e) {
                    console.error(`Failed to remove old timestamp file ${file}:`, e);
                }
            }
        });

        console.log(`Created new timestamp file: ${newFilePath}`);
    } catch (error) {
        console.error("Error updating timestamp:", error);
    }
}

export function getLastCloseTime() {
    try {
        // Get all timestamp files and sort them (newest first)
        const timestampFiles = getTimestampFiles().reverse();

        if (timestampFiles.length === 0) {
            return null;
        }

        // Get the newest file
        const newestFile = timestampFiles[0];

        // Extract timestamp from the filename
        const filename = path.basename(newestFile);
        // Remove "timestamp_" prefix and ".json" extension
        const timestampPart = filename.substring(10, filename.length - 5);

        // Convert the formatted timestamp back to original format
        const timestamp = timestampPart.replace(/_/g, function (match, offset) {
            // Replace underscores with appropriate characters based on position
            if (offset === 10 || offset === 13 || offset === 16) {
                return ':';  // For time separators
            } else if (offset === 7) {
                return ' ';  // For date-time separator
            }
            return '-';      // For date separators
        });

        return timestamp;
    } catch (error) {
        console.error("Error getting last close time:", error);
        return null;
    }
}