import * as fs from 'fs';
import { app, desktopCapturer, screen, Notification } from 'electron';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const sanitizeFilename = (filename: string): string => {
    // Replace invalid characters with underscores
    return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
};

const showNotification = (success: boolean, displayCount?: number, error?: string) => {
    if (!Notification.isSupported()) {
        console.log('Notifications are not supported on this system');
        return;
    }

    if (success) {
        new Notification({
            title: 'Screenshot Captured',
            body: `Successfully captured screenshot${displayCount && displayCount > 1 ? 's' : ''} from ${displayCount} display${displayCount && displayCount > 1 ? 's' : ''}`,
            icon: path.join(app.getPath('userData'), 'screenshot-icon.png') // Optional: Add your own icon
        }).show();
    } else {
        new Notification({
            title: 'Screenshot Failed',
            body: error || 'Failed to capture screenshot',
            icon: path.join(app.getPath('userData'), 'error-icon.png') // Optional: Add your own icon
        }).show();
    }
};


const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
    try {
        // Normalize the path to handle Windows path separators correctly
        const normalizedPath = path.normalize(dirPath);

        // Check if directory exists
        try {
            await fs.promises.access(normalizedPath);
        } catch {
            // Directory doesn't exist, create it
            await fs.promises.mkdir(normalizedPath, { recursive: true });

            // For Windows: Remove hidden attribute and ensure proper permissions
            if (process.platform === 'win32') {
                try {
                    await execAsync(`attrib -h "${normalizedPath}"`);
                } catch (error) {
                    console.warn('Failed to remove hidden attribute:', error);
                }
            }
        }
    } catch (error) {
        console.error('Error ensuring directory exists:', error);
        throw error;
    }
};

const captureAndSaveScreenshot = async (time: {
    project_id: number;
    selectedTaskId: number;
    hours: number;
    minutes: number;
    seconds: number;
}): Promise<string[]> => {
    const savedFiles: string[] = [];

    try {
        const displays = screen.getAllDisplays();
        const baseScreenshotPath = path.normalize(
            path.join(app.getPath('userData'), 'ASD_Screenshots')
        );

        // Ensure the directory exists before proceeding
        await ensureDirectoryExists(baseScreenshotPath);

        for (let i = 0; i < displays.length; i++) {
            const display = displays[i];
            const { bounds } = display;

            try {
                // Get screen sources
                const sources = await desktopCapturer.getSources({
                    types: ['screen'],
                    thumbnailSize: { width: bounds.width, height: bounds.height }
                });

                // Find the correct source for this display
                const source = sources.find(
                    (s) =>
                        s.display_id === display.id.toString() ||
                        (s.id.startsWith('screen:') && sources.length === 1)
                );

                if (!source?.thumbnail) {
                    console.error(`No source found for display ${i + 1}`);
                    continue;
                }

                // Create filename with sanitized timestamp
                const timestamp = new Date().toISOString();
                const fileName = sanitizeFilename(
                    `${time.project_id}_${time.selectedTaskId}_${timestamp}_display${i + 1}.png`
                );
                const filePath = path.normalize(path.join(baseScreenshotPath, fileName));

                // Ensure the PNG data is valid before writing
                const pngBuffer = source.thumbnail.toPNG();
                if (!pngBuffer || pngBuffer.length === 0) {
                    throw new Error('Invalid PNG data generated');
                }

                // Write file with explicit encoding
                await fs.promises.writeFile(filePath, pngBuffer, { encoding: 'binary' });
                console.log(`Screenshot saved for display ${i + 1}: ${filePath}`);
                savedFiles.push(filePath);
            } catch (displayError) {
                console.error(`Error processing display ${i + 1}:`, displayError);
                // Continue with other displays
                continue;
            }
        }

        if (savedFiles.length === 0) {
            throw new Error('No screenshots were captured successfully');
        }
        showNotification(true, savedFiles.length);

        return savedFiles;
    } catch (error) {
        console.error('Error capturing screenshot:', error);
        throw error;
    }
};

export default captureAndSaveScreenshot;