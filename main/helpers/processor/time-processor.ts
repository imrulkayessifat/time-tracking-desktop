import Database from '../db';
import AuthTokenStore from '../auth-token-store';
import path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

interface TimeProcessingResult {
    success: boolean;
    message: string;
    timeEntryId: number;
}

interface TimeEntry {
    id: number;
    project_id: number;
    task_id: number | null;
    start_time: string | null;
    end_time: string | null;
}

export class TimeProcessor {
    private processingInterval: NodeJS.Timeout | null = null;
    private isProcessing: boolean = false;
    private db: Database;
    private isInitialized: boolean = false;

    constructor(
        private apiEndpoint: string,
        private intervalMs: number = 30000
    ) {
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
    }

    private async initializeDatabase(): Promise<void> {
        try {
            const dbDir = path.join(app.getPath('userData'), 'db');

            // Ensure directory exists
            await this.ensureDirectoryExists(dbDir);

            const dbPath = path.join(dbDir, 'timetracking.db');
            this.db = new Database(dbPath);

            // Create table if not exists
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS time_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    task_id INTEGER,
                    start_time TEXT,
                    end_time TEXT
                )
            `).run();

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize database:', error);
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
    getLocalTime() {
        // Create a new Date object for the current local time
        const currentUtcTime = new Date();
        const localTimeOffset = currentUtcTime.getTimezoneOffset() * 60000; // Convert offset to milliseconds
        return new Date(currentUtcTime.getTime() - localTimeOffset).toISOString();
    };

    // Insert start time for a new or existing time entry
    public insertStartTime(
        project_id: number,
        task_id?: number
    ): number {
        try {
            const insertStmt = this.db.prepare(`
                INSERT INTO time_entries 
                (project_id, start_time, task_id) 
                VALUES (?, ?, ?)
            `);

            const startTime = this.getLocalTime();
            const result = insertStmt.run(
                project_id,
                startTime,
                task_id ?? null
            );

            return result.lastInsertRowid as number;
        } catch (error) {
            console.error('Error inserting start time:', error);
            throw error;
        }
    }

    // Update end time for an existing time entry
    public updateEndTime(
        time_entry_id: number,
    ): void {
        try {
            const endTime = this.getLocalTime();
            const updateStmt = this.db.prepare(`
                UPDATE time_entries 
                SET end_time = ? 
                WHERE id = ?
            `);

            updateStmt.run(endTime, time_entry_id);
        } catch (error) {
            console.error('Error updating end time:', error);
            throw error;
        }
    }

    // Get the most recent unfinished time entry for a project
    public getLatestUnfinishedTimeEntry(
        project_id: number,
        task_id?: number
    ): TimeEntry | null {
        try {
            const selectStmt = this.db.prepare(`
                SELECT * FROM time_entries 
                WHERE project_id = ? 
                AND (task_id = ? OR (? IS NULL AND task_id IS NULL))
                AND end_time IS NULL 
                ORDER BY start_time DESC 
                LIMIT 1
            `);

            return selectStmt.get(project_id, task_id ?? null, task_id ?? null) as TimeEntry | null;
        } catch (error) {
            console.error('Error getting latest unfinished time entry:', error);
            throw error;
        }
    }

    // Start the processing loop
    public startProcessing(): void {
        console.log('Starting time entry processing...');

        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }

        // Initial processing
        console.log('Running initial processing...');
        this.processTimeEntries()
            .then(() => console.log('Initial processing completed'))
            .catch(err => console.error('Error in initial processing:', err));

        this.processingInterval = setInterval(() => {
            console.log('Interval triggered, starting new processing cycle');
            this.processTimeEntries()
                .then(() => console.log('Processing cycle completed'))
                .catch(err => console.error('Error in processing cycle:', err));
        }, this.intervalMs);

        console.log('Processing started successfully');
    }

    // Stop the processing loop
    public stopProcessing(): void {
        console.log('Stopping time entry processing...');
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            console.log('Processing stopped');
        } else {
            console.log('No processing was running');
        }
    }

    // Process a single time entry
    private async processTimeEntry(timeEntry: TimeEntry): Promise<TimeProcessingResult> {
        try {
            // Only process time entries with both start and end times
            if (!timeEntry.start_time || !timeEntry.end_time) {
                return {
                    success: false,
                    message: 'Incomplete time entry',
                    timeEntryId: timeEntry.id
                };
            }

            // Prepare API payload
            const payload = {
                project_id: timeEntry.project_id,
                start_time: timeEntry.start_time,
                end_time: timeEntry.end_time,
                ...(timeEntry.task_id !== -1 && { task_id: timeEntry.task_id })
            };

            console.log('Making API call for time entry:', payload);

            // Make API call
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    "data": [
                        payload
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`API call failed for time entry : ${response.statusText}`);
            }

            console.log('API call successful, deleting time entry:', await response.json());

            // Delete the time entry after successful API call
            const deleteStmt = this.db.prepare('DELETE FROM time_entries WHERE id = ?');
            deleteStmt.run(timeEntry.id);

            return {
                success: true,
                message: 'Successfully processed and deleted time entry',
                timeEntryId: timeEntry.id
            };

        } catch (error) {
            console.error('Error processing time entry:', timeEntry.id, error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error',
                timeEntryId: timeEntry.id
            };
        }
    }

    // Process all pending time entries in the database
    private async processTimeEntries(): Promise<void> {
        console.log('Starting processing cycle');

        if (this.isProcessing) {
            console.log('Already processing time entries, skipping this cycle');
            return;
        }

        this.isProcessing = true;
        console.log('Processing lock acquired');

        try {
            // Get all pending time entries with both start and end times
            const selectStmt = this.db.prepare(`
                SELECT * FROM time_entries 
                WHERE start_time IS NOT NULL 
                AND end_time IS NOT NULL
                ORDER BY start_time ASC
                LIMIT 100
            `);

            const timeEntries: TimeEntry[] = selectStmt.all();

            if (timeEntries.length === 0) {
                console.log('No time entries to process');
                return;
            }

            const results = await Promise.all(
                timeEntries.map(timeEntry => this.processTimeEntry(timeEntry))
            );

            // Log results
            results.forEach(result => {
                if (result.success) {
                    console.log(`Successfully processed time entry ${result.timeEntryId}`);
                } else {
                    console.error(`Failed to process time entry ${result.timeEntryId}: ${result.message}`);
                }
            });

        } catch (error) {
            console.error('Error in processTimeEntries:', error);
        } finally {
            this.isProcessing = false;
            console.log('Processing lock released');
        }
    }

    // Get all unprocessed time entries
    public getUnprocessedTimeEntries(): TimeEntry[] {
        const selectStmt = this.db.prepare(`
            SELECT * FROM time_entries 
            WHERE start_time IS NOT NULL 
            AND end_time IS NOT NULL
            ORDER BY start_time ASC
        `);

        return selectStmt.all();
    }
}