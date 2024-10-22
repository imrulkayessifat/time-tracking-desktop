import * as fs from 'fs';
import {
    app,
    desktopCapturer,
    screen
} from 'electron'
import path from 'path'

const captureAndSaveScreenshot = async (time: { project_id: number, selectedTaskId: number, hours: number, minutes: number, seconds: number }) => {
    try {

        const displays = screen.getAllDisplays();
        const screenshotPath = path.join(app.getPath('pictures'), 'ASD_Screenshots');

        if (!fs.existsSync(screenshotPath)) {
            fs.mkdirSync(screenshotPath, { recursive: true });
        }

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

            if (source && source.thumbnail) {
                const fileName = `${time.project_id}_${time.selectedTaskId}_${new Date().toISOString()}_.png`;
                const filePath = path.join(screenshotPath, fileName);

                fs.writeFileSync(filePath, source.thumbnail.toPNG());
                console.log(`Screenshot saved for display ${i + 1}: ${filePath}`);
            } else {
                console.error(`No source found for display ${i + 1}`);
            }
        }
    } catch (error) {
        console.error('Error capturing screenshot:', error);
    }
};

export default captureAndSaveScreenshot;