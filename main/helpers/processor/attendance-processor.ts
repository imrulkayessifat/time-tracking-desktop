import Database from '../db';
import AuthTokenStore from '../auth-token-store';
import path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import axios from 'axios';

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

interface AttendanceProcessingResult {
    success: boolean;
    message: string;
    attendanceEntryId: number;
}

interface AttendanceEntry {
    id: number;
    attendance_time: string | null;
}

export class AttendanceProcessor {
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
                        console.log('Failed to remove hidden attribute:', error);
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

            const dbPath = path.join(dbDir, 'attendance.db');
            this.db = new Database(dbPath);

            // Create table if not exists
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS attendance (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    attendance_time TEXT
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

    private getAuthHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        const tokenStore = AuthTokenStore.getInstance();
        const token = tokenStore.getToken();

        if (token) {
            headers['Authorization'] = token;
        }

        return headers;
    }
    getLocalTime() {
        // Create a new Date object for the current local time
        const currentUtcTime = new Date();
        const localTimeOffset = currentUtcTime.getTimezoneOffset() * 60000; // Convert offset to milliseconds
        return new Date(currentUtcTime.getTime() - localTimeOffset).toISOString();
    };

    // Insert attendance time for a new or existing attendance entry
    public insertAttendanceTime(
    ): number {
        try {
            const insertStmt = this.db.prepare(`
                INSERT INTO attendance 
                (attendance_time) 
                VALUES (?)
            `);

            const attendance_time = this.getLocalTime();
            console.log("attendance time:", attendance_time)
            const result = insertStmt.run(
                attendance_time,
            );

            return result.lastInsertRowid as number;
        } catch (error) {
            console.error('Error inserting attendance time:', error);
            throw error;
        }
    }

    // Start the processing loop
    public startProcessing(): void {
        console.log('Starting attendance entry processing...');

        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }

        // Initial processing
        console.log('Running initial processing...');
        this.processAttendanceEntries()
            .then(() => console.log('Initial processing completed'))
            .catch(err => console.error('Error in initial processing:', err));

        this.processingInterval = setInterval(() => {
            console.log('Interval triggered, starting new processing cycle');
            this.processAttendanceEntries()
                .then(() => console.log('Processing cycle completed'))
                .catch(err => console.error('Error in processing cycle:', err));
        }, this.intervalMs);

        console.log('Processing started successfully');
    }

    // Stop the processing loop
    public stopProcessing(): void {
        console.log('Stopping attendance entry processing...');
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            console.log('Processing stopped');
        } else {
            console.log('No processing was running');
        }
    }

    // Process a single attendance entry
    private async processAttendanceEntry(attendanceEntry: AttendanceEntry): Promise<AttendanceProcessingResult> {
        try {
            // Only process time entries with both start and end times
            if (!attendanceEntry.attendance_time) {
                return {
                    success: false,
                    message: 'Incomplete attendance entry',
                    attendanceEntryId: attendanceEntry.id
                };
            }

            // Prepare API payload
            const payload = {
                check_in: attendanceEntry.attendance_time,
            };

            console.log('Making API call for attendance entry:', payload);

            // Make API call
            const response = await axios.post(this.apiEndpoint, { data: [payload] }, {
                headers: this.getAuthHeaders(),
            });

            const { success, message, data } = response.data

            if (!success) {
                throw new Error(`API call failed for attendance entry : ${message}`);
            }

            console.log('API call successful, deleting attendance entry:', message, data);

            // Delete the attendance entry after successful API call
            const deleteStmt = this.db.prepare('DELETE FROM attendance WHERE id = ?');
            deleteStmt.run(attendanceEntry.id);

            return {
                success: true,
                message: 'Successfully processed and deleted attendance entry',
                attendanceEntryId: attendanceEntry.id
            };

        } catch (error) {
            console.error('Error processing attendance entry:', attendanceEntry.id, error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error',
                attendanceEntryId: attendanceEntry.id
            };
        }
    }

    // Process all pending attendance entries in the database
    public async processAttendanceEntries(): Promise<void> {
        console.log('Starting processing cycle');

        if (this.isProcessing) {
            console.log('Already processing attendance entries, skipping this cycle');
            return;
        }

        this.isProcessing = true;
        console.log('Processing lock acquired');

        try {
            // Get all pending attendance entries
            const selectStmt = this.db.prepare(`
                SELECT * FROM attendance 
                ORDER BY id ASC
                LIMIT 100
            `);

            const attendanceEntries: AttendanceEntry[] = selectStmt.all();

            if (attendanceEntries.length === 0) {
                console.log('No attendance entries to process');
                return;
            }

            const results = await Promise.all(
                attendanceEntries.map(attendanceEntry => this.processAttendanceEntry(attendanceEntry))
            );

            // Log results
            results.forEach(result => {
                if (result.success) {
                    console.log(`Successfully processed attendance entry ${result.attendanceEntryId}`);
                } else {
                    console.error(`Failed to process attendance entry ${result.attendanceEntryId}: ${result.message}`);
                }
            });

        } catch (error) {
            console.error('Error in processAttendanceEntries:', error);
        } finally {
            this.isProcessing = false;
            console.log('Processing lock released');
        }
    }
}