import Database from '../db';
import AuthTokenStore from '../auth-token-store';
import path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import axios from 'axios';

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

interface IdleProcessingResult {
    success: boolean;
    message: string;
    idleEntryId: number;
}

interface IdleEntry {
    id: number;
    project_id: number;
    task_id: number;
    start_time: string | null;
    end_time: string | null;
    duration: number;  // Duration in seconds
}

export class IdleTimeProcessor {
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
            const normalizedPath = path.normalize(dirPath);
            try {
                await fs.promises.access(normalizedPath);
            } catch {
                await fs.promises.mkdir(normalizedPath, { recursive: true });
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
            await this.ensureDirectoryExists(dbDir);

            const dbPath = path.join(dbDir, 'idletracking.db');
            this.db = new Database(dbPath);

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

    public startProcessing(): void {
        console.log('Starting idle time processing...');

        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }

        console.log('Running initial idle time processing...');
        this.processIdleEntries()
            .then(() => console.log('Initial idle processing completed'))
            .catch(err => console.error('Error in initial idle processing:', err));

        this.processingInterval = setInterval(() => {
            console.log('Interval triggered, starting new idle processing cycle');
            this.processIdleEntries()
                .then(() => console.log('Idle processing cycle completed'))
                .catch(err => console.error('Error in idle processing cycle:', err));
        }, this.intervalMs);
    }

    public stopProcessing(): void {
        console.log('Stopping idle time processing...');
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            console.log('Idle processing stopped');
        } else {
            console.log('No processing was running');
        }
    }

    private async processIdleEntry(idleEntry: IdleEntry): Promise<IdleProcessingResult> {
        try {
            if (!idleEntry.start_time || !idleEntry.end_time) {
                return {
                    success: false,
                    message: 'Incomplete idle entry',
                    idleEntryId: idleEntry.id
                };
            }

            const payload = idleEntry.task_id === -1
                ? {
                    project_id: idleEntry.project_id,
                    start_time: idleEntry.start_time,
                    end_time: idleEntry.end_time
                }
                : {
                    project_id: idleEntry.project_id,
                    task_id: idleEntry.task_id,
                    start_time: idleEntry.start_time,
                    end_time: idleEntry.end_time
                };


            console.log('Making API call for idle entry:', payload);

            const response = await axios.post(this.apiEndpoint, {
                idle_time: [payload]
            }, {
                headers: this.getAuthHeaders(),
            });

            const { success, message, data } = response.data;
            console.log("idle api call : ", response.data)
            if (!success) {
                throw new Error(`API call failed for idle entry: ${message}`);
            }

            console.log('API call successful, deleting idle entry:', message, data);

            const deleteStmt = this.db.prepare('DELETE FROM idle_entries WHERE id = ?');
            deleteStmt.run(idleEntry.id);

            return {
                success: true,
                message: 'Successfully processed and deleted idle entry',
                idleEntryId: idleEntry.id
            };

        } catch (error) {
            console.error('Error processing idle entry:', idleEntry.id, error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error',
                idleEntryId: idleEntry.id
            };
        }
    }

    public async processIdleEntries(): Promise<void> {
        console.log('Starting idle processing cycle');

        if (this.isProcessing) {
            console.log('Already processing idle entries, skipping this cycle');
            return;
        }

        this.isProcessing = true;
        console.log('Idle processing lock acquired');

        try {
            const selectStmt = this.db.prepare(`
                SELECT * FROM idle_entries 
                WHERE start_time IS NOT NULL 
                AND end_time IS NOT NULL
                ORDER BY start_time ASC
                LIMIT 100
            `);

            const idleEntries: IdleEntry[] = selectStmt.all();

            if (idleEntries.length === 0) {
                console.log('No idle entries to process');
                return;
            }

            const results = await Promise.all(
                idleEntries.map(idleEntry => this.processIdleEntry(idleEntry))
            );

            results.forEach(result => {
                if (result.success) {
                    console.log(`Successfully processed idle entry ${result.idleEntryId}`);
                } else {
                    console.error(`Failed to process idle entry ${result.idleEntryId}: ${result.message}`);
                }
            });

        } catch (error) {
            console.error('Error in processIdleEntries:', error);
        } finally {
            this.isProcessing = false;
            console.log('Idle processing lock released');
        }
    }

    public getUnprocessedIdleEntries(): IdleEntry[] {
        const selectStmt = this.db.prepare(`
            SELECT * FROM idle_entries 
            WHERE start_time IS NOT NULL 
            AND end_time IS NOT NULL
            AND duration > 0
            ORDER BY start_time ASC
        `);

        return selectStmt.all();
    }
}