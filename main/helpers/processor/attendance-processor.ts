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
    date: string;
    check_in: string | null;
    check_out: string | null;
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

            const dbPath = path.join(dbDir, 'attendance.db');
            this.db = new Database(dbPath);

            // Create table if not exists
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS attendance (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT,
                    check_in TEXT,
                    check_out TEXT
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

    convertTo12HourFormat(isoTime) {
        // Parse the ISO time string
        const date = new Date(`1970-01-01T${isoTime}`);

        // Extract hours, minutes, and seconds
        let hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();

        // Determine AM or PM
        const ampm = hours >= 12 ? 'PM' : 'AM';

        // Convert to 12-hour format
        hours = hours % 12;
        hours = hours === 0 ? 12 : hours;

        // Format the time string with leading zeros for minutes and seconds
        const formattedTime = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${ampm}`;
        return formattedTime;
    }

    // Insert start time for a new or existing time entry
    public insertAttendanceStart(
    ): number {
        try {
            const insertStmt = this.db.prepare(`
                INSERT INTO attendance 
                (date, check_in) 
                VALUES (?, ?)
            `);

            const date = this.getLocalTime().split('T')[0];
            const check_in = this.convertTo12HourFormat(this.getLocalTime().split('T')[1])
            console.warn("start time:", date)
            const result = insertStmt.run(
                date,
                check_in,
            );

            return result.lastInsertRowid as number;
        } catch (error) {
            console.error('Error inserting attendance start time:', error);
            throw error;
        }
    }

    public insertAttendanceEnd(
    ): number {
        try {
            const insertStmt = this.db.prepare(`
                INSERT INTO attendance 
                (date, check_out) 
                VALUES (?, ?)
            `);

            const date = this.getLocalTime().split('T')[0];
            const check_out = this.convertTo12HourFormat(this.getLocalTime().split('T')[1])
            console.warn("start time:", date)
            const result = insertStmt.run(
                date,
                check_out,
            );

            return result.lastInsertRowid as number;
        } catch (error) {
            console.error('Error inserting attendance start time:', error);
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
    private async processAttendanceEntry(attendanceEntry: AttendanceEntry): Promise<AttendanceProcessingResult> {
        try {
            // Only process time entries with both start and end times
            if (!attendanceEntry.date) {
                return {
                    success: false,
                    message: 'Incomplete time entry',
                    attendanceEntryId: attendanceEntry.id
                };
            }

            // Prepare API payload
            const payload = {
                date: attendanceEntry.date,
                ...(attendanceEntry.check_in && { check_in: attendanceEntry.check_in }),
                ...(attendanceEntry.check_out && { check_out: attendanceEntry.check_out })
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

            // Delete the time entry after successful API call
            const deleteStmt = this.db.prepare('DELETE FROM attendance WHERE id = ?');
            deleteStmt.run(attendanceEntry.id);

            return {
                success: true,
                message: 'Successfully processed and deleted attendance entry',
                attendanceEntryId: attendanceEntry.id
            };

        } catch (error) {
            console.error('Error processing time entry:', attendanceEntry.id, error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error',
                attendanceEntryId: attendanceEntry.id
            };
        }
    }

    // Process all pending time entries in the database
    public async processAttendanceEntries(): Promise<void> {
        console.log('Starting processing cycle');

        if (this.isProcessing) {
            console.log('Already processing attendance entries, skipping this cycle');
            return;
        }

        this.isProcessing = true;
        console.log('Processing lock acquired');

        try {
            // Get all pending time entries with both start and end times
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
                    console.log(`Successfully processed time entry ${result.attendanceEntryId}`);
                } else {
                    console.error(`Failed to process time entry ${result.attendanceEntryId}: ${result.message}`);
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
    public getUnprocessedTimeEntries(): AttendanceEntry[] {
        const selectStmt = this.db.prepare(`
            SELECT * FROM attendance 
            ORDER BY id ASC
        `);

        return selectStmt.all();
    }
}