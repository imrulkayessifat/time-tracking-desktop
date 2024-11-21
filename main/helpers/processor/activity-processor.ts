import Database from '../db';
import AuthTokenStore from '../auth-token-store';
import path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

interface ActivityProcessingResult {
    success: boolean;
    message: string;
    activityId: number;
}

interface Activity {
    id: number;
    project_id: number;
    task_id: number;
    app_name: string;
    url: string;
    timestamp: string;
}

export class ActivityProcessor {
    private processingInterval: NodeJS.Timeout | null = null;
    private isProcessing: boolean = false;
    private db: Database;
    private isInitialized: boolean = false;

    constructor(private apiEndpoint: string, private intervalMs: number = 30000) {
        // const dbDir = path.join(app.getPath('userData'), 'db');

        // const dbPath = path.join(dbDir, 'timetracking.db');
        // this.db = new Database(dbPath);
        this.initializeDatabase();

    }

    async ensureDirectoryExists(dirPath: string): Promise<void> {
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

    private async initializeDatabase(): Promise<void> {
        try {
            const dbDir = path.join(app.getPath('userData'), 'db');

            // Ensure directory exists
            await this.ensureDirectoryExists(dbDir);

            const dbPath = path.join(dbDir, 'timetracking.db');
            this.db = new Database(dbPath);
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize database:', error);
            // Optionally, implement retry logic or error handling
        }
    }
    public async waitForInitialization(): Promise<void> {
        while (!this.isInitialized) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
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
        console.log('Starting activity processing...');

        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }

        // Initial processing
        console.log('Running initial processing...');
        this.processActivities()
            .then(() => console.log('Initial processing completed'))
            .catch(err => console.error('Error in initial processing:', err));

        this.processingInterval = setInterval(() => {
            console.log('Interval triggered, starting new processing cycle');
            this.processActivities()
                .then(() => console.log('Processing cycle completed'))
                .catch(err => console.error('Error in processing cycle:', err));
        }, this.intervalMs);

        console.log('Processing started successfully');
    }

    // Stop the processing loop
    public stopProcessing(): void {
        console.log('Stopping activity processing...');
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            console.log('Processing stopped');
        } else {
            console.log('No processing was running');
        }
    }

    // Process a single activity record
    private async processActivity(activity: Activity): Promise<ActivityProcessingResult> {
        try {
            // Prepare API payload
            const payload = {
                project_id: activity.project_id,
                app_name: activity.app_name,
                url: activity.url,
                timestamp: activity.timestamp,
                ...(activity.task_id !== -1 && { task_id: activity.task_id })
            };

            console.log('Making API call for activity:', activity.id);

            // Make API call
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API call failed: ${response.statusText}`);
            }

            console.log('API call successful, deleting activity:', activity.id);

            // Delete the activity after successful API call
            const deleteStmt = this.db.prepare('DELETE FROM activities WHERE id = ?');
            deleteStmt.run(activity.id);

            return {
                success: true,
                message: 'Successfully processed and deleted activity',
                activityId: activity.id
            };

        } catch (error) {
            console.error('Error processing activity:', activity.id, error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error',
                activityId: activity.id
            };
        }
    }

    // Process all pending activities in the database
    private async processActivities(): Promise<void> {
        console.log('Starting processing cycle');

        if (this.isProcessing) {
            console.log('Already processing activities, skipping this cycle');
            return;
        }

        this.isProcessing = true;
        console.log('Processing lock acquired');

        try {
            // Get all pending activities
            const selectStmt = this.db.prepare(`
                SELECT * FROM activities 
                ORDER BY timestamp ASC
                LIMIT 100
            `);

            const activities: Activity[] = selectStmt.all();

            if (activities.length === 0) {
                console.log('No activities to process');
                return;
            }

            const results = await Promise.all(
                activities.map(activity => this.processActivity(activity))
            );

            // Log results
            results.forEach(result => {
                if (result.success) {
                    console.log(`Successfully processed activity ${result.activityId}`);
                } else {
                    console.error(`Failed to process activity ${result.activityId}: ${result.message}`);
                }
            });

        } catch (error) {
            console.error('Error in processActivities:', error);
        } finally {
            this.isProcessing = false;
            console.log('Processing lock released');
        }
    }
}