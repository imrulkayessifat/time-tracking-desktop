import * as fs from 'fs';
import {
    app,
    desktopCapturer,
    screen
} from 'electron';
import path from 'path';

const sanitizeFileName = (fileName: string): string => {
    // Replace invalid characters with underscores
    return fileName.replace(/[<>:"/\\|?*]/g, '_');
};

const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
    try {
        await fs.promises.access(dirPath);
    } catch {
        // Directory doesn't exist, create it
        await fs.promises.mkdir(dirPath, { recursive: true });
    }
};

const captureAndSaveScreenshot = async (time: {
    project_id: number,
    selectedTaskId: number,
    hours: number,
    minutes: number,
    seconds: number
}): Promise<string[]> => {
    const savedFiles: string[] = [];

    try {
        const displays = screen.getAllDisplays();
        const baseScreenshotPath = path.join(app.getPath('userData'), 'ASD_Screenshots');

        // Ensure the directory exists before trying to save files
        await ensureDirectoryExists(baseScreenshotPath);

        for (let i = 0; i < displays.length; i++) {
            const display = displays[i];
            const { bounds } = display;

            try {
                const sources = await desktopCapturer.getSources({
                    types: ['screen'],
                    thumbnailSize: { width: bounds.width, height: bounds.height }
                });

                const source = sources.find(s =>
                    s.display_id === display.id.toString() ||
                    (s.id.startsWith('screen:') && sources.length === 1)
                );

                if (!source?.thumbnail) {
                    console.error(`No source found for display ${i + 1}`);
                    continue;
                }

                const timestamp = new Date().toISOString();
                const fileName = sanitizeFileName(
                    `${time.project_id}_${time.selectedTaskId}_${timestamp}_display${i + 1}.png`
                );
                const filePath = path.join(baseScreenshotPath, fileName);

                try {
                    await fs.promises.writeFile(filePath, source.thumbnail.toPNG());
                    console.log(`Screenshot saved for display ${i + 1}: ${filePath}`);
                    savedFiles.push(filePath);
                } catch (writeError) {
                    console.error(`Error writing screenshot for display ${i + 1}:`, writeError);
                    // Continue with other displays instead of throwing
                    continue;
                }
            } catch (displayError) {
                console.error(`Error processing display ${i + 1}:`, displayError);
                // Continue with other displays
                continue;
            }
        }

        if (savedFiles.length === 0) {
            throw new Error('No screenshots were captured successfully');
        }

        return savedFiles;
    } catch (error) {
        console.error('Error capturing screenshot:', error);
        throw error;
    }
};

export default captureAndSaveScreenshot;