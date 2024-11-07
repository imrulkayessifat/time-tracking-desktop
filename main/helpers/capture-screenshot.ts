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
        // Use app.getPath('userData') instead of 'logs' for better compatibility
        const baseScreenshotPath = path.join(app.getPath('userData'), 'ASD_Screenshots');

        // Create directory if it doesn't exist
        await fs.promises.mkdir(baseScreenshotPath, { recursive: true });

        for (let i = 0; i < displays.length; i++) {
            const display = displays[i];
            const { bounds } = display;

            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: bounds.width, height: bounds.height }
            });

            const source = sources.find(s =>
                s.display_id === display.id.toString() ||
                (s.id.startsWith('screen:') && sources.length === 1)
            );

            if (source?.thumbnail) {
                // Create a sanitized filename
                const timestamp = new Date().toISOString();
                // const fileName = sanitizeFileName(

                // );
                const fileName = `${time.project_id}_${time.selectedTaskId}_${timestamp}_display${i + 1}.png`
                const filePath = path.join(baseScreenshotPath, fileName);

                try {
                    // Use async file writing
                    await fs.promises.writeFile(filePath, source.thumbnail.toPNG());
                    console.log(`Screenshot saved for display ${i + 1}: ${filePath}`);
                    savedFiles.push(filePath);
                } catch (writeError) {
                    console.error(`Error writing screenshot for display ${i + 1}:`, writeError);
                    throw writeError;
                }
            } else {
                console.error(`No source found for display ${i + 1}`);
            }
        }

        return savedFiles;
    } catch (error) {
        console.error('Error capturing screenshot:', error);
        throw error; // Re-throw the error for handling by the caller
    }
};

export default captureAndSaveScreenshot;