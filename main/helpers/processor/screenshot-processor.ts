import * as fs from 'fs';
import path from 'path';
import { app } from 'electron';

import AuthTokenStore from '../auth-token-store';

interface ImageProcessingResult {
    success: boolean;
    message: string;
    fileName: string;
}

interface ParsedImageInfo {
    projectId: number;
    taskId: number;
    timestamp: string;
}

export class ScreenshotProcessor {
    private screenshotPath: string;
    private processingInterval: NodeJS.Timeout | null = null;
    private isProcessing: boolean = false;

    constructor(private apiEndpoint: string, private intervalMs: number = 60000) {
        this.screenshotPath = path.join(app.getPath('userData'), 'ASD_Screenshots');
    }

    private getAuthHeaders(): Headers {
        const headers = new Headers({
            'Content-Type': 'application/json'
        });

        const tokenStore = AuthTokenStore.getInstance();
        const token = tokenStore.getToken();

        if (token) {
            headers.append('Authorization', `${token}`);
        }

        return headers;
    }


    // Start the processing loop
    public startProcessing(): void {
        console.log('Starting screenshot processing...');

        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }

        // Verify the screenshots directory exists
        if (!fs.existsSync(this.screenshotPath)) {
            fs.mkdirSync(this.screenshotPath, { recursive: true });
        }

        // Initial processing
        console.log('Running initial processing...');
        this.processImages()
            .then(() => console.log('Initial processing completed'))
            .catch(err => console.error('Error in initial processing:', err));

        this.processingInterval = setInterval(() => {
            console.log('Interval triggered, starting new processing cycle');
            this.processImages()
                .then(() => console.log('Processing cycle completed'))
                .catch(err => console.error('Error in processing cycle:', err));
        }, this.intervalMs);

        console.log('Processing started successfully');
    }

    // Stop the processing loop
    public stopProcessing(): void {
        console.log('Stopping screenshot processing...');
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            console.log('Processing stopped');
        } else {
            console.log('No processing was running');
        }
    }

    // Parse image filename to extract information
    private parseImageFileName(fileName: string): ParsedImageInfo | null {
        console.log('Parsing filename:', fileName);
        const match = fileName.match(/^(-?\d+)_(-?\d+)_(.+)_display(\d+)\.png$/);

        if (!match) {
            console.log('Failed to parse filename:', fileName);
            return null;
        }

        const result = {
            projectId: parseInt(match[1]),
            taskId: parseInt(match[2]),
            timestamp: match[3],
        };
        return result;
    }

    // Convert image to base64
    private async imageToBase64(filePath: string): Promise<string> {
        try {
            const buffer = await fs.promises.readFile(filePath);
            const base64 = buffer.toString('base64');
            console.log('Successfully converted image to base64');
            return base64;
        } catch (error) {
            console.error('Error converting image to base64:', error);
            throw error;
        }
    }

    // Process a single image
    private async processImage(fileName: string): Promise<ImageProcessingResult> {
        const filePath = path.join(this.screenshotPath, fileName);

        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                console.error('File does not exist:', filePath);
                return {
                    success: false,
                    message: 'File does not exist',
                    fileName
                };
            }

            // Parse file name
            const imageInfo = this.parseImageFileName(fileName);
            if (!imageInfo) {
                return {
                    success: false,
                    message: 'Invalid filename format',
                    fileName
                };
            }

            // Convert image to base64
            const base64Image = await this.imageToBase64(filePath);

            // Prepare API payload
            const payload = {
                project_id: imageInfo.projectId,
                timestamp: imageInfo.timestamp,
                image: base64Image,
                ...(imageInfo.taskId !== -1 && { task_id: imageInfo.taskId })
            };

            // Make API call
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API call failed: ${response.statusText}`);
            }

            console.log('API call successful, deleting image:', fileName);
            // Delete the image after successful API call
            await fs.promises.unlink(filePath);

            return {
                success: true,
                message: 'Successfully processed and deleted image',
                fileName
            };

        } catch (error) {
            console.error('Error processing image:', fileName, error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error',
                fileName
            };
        }
    }

    // Process all images in the directory
    private async processImages(): Promise<void> {
        console.log('Starting processing cycle');

        if (this.isProcessing) {
            console.log('Already processing images, skipping this cycle');
            return;
        }

        this.isProcessing = true;
        console.log('Processing lock acquired');

        try {
            // Ensure directory exists
            await fs.promises.mkdir(this.screenshotPath, { recursive: true });

            // Get all PNG files
            const files = await fs.promises.readdir(this.screenshotPath);
            const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));

            if (pngFiles.length === 0) {
                console.log('No PNG files to process');
                return;
            }

            const results = await Promise.all(
                pngFiles.map(file => this.processImage(file))
            );

            // Log results
            results.forEach(result => {
                if (result.success) {
                    console.log(`Successfully processed ${result.fileName}`);
                } else {
                    console.error(`Failed to process ${result.fileName}: ${result.message}`);
                }
            });

        } catch (error) {
            console.error('Error in processImages:', error);
        } finally {
            this.isProcessing = false;
            console.log('Processing lock released');
        }
    }
}