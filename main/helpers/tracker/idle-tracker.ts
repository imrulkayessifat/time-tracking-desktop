// idle-tracker.ts
import { Notification, powerMonitor, dialog } from 'electron';
import { app } from 'electron';
import path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

import Database from '../db';
import AuthTokenStore from '../auth-token-store';
import { mainWindow } from '../../background';
import { getLocalTime } from '../lib/getLocalTime';

interface IdlePeriod {
    project_id: number;
    task_id: number;
    start_time: string;
    end_time: string;
}

interface TaskIdleTime {
    taskId: number;
    projectId: number;
    startTime?: string;
    endTime?: string;
    totalIdleTime: number;
    isIdle: boolean;
}

export class TaskIdleTracker {
    private taskIdleTimes: Map<string, TaskIdleTime>;
    private idleThreshold: number;
    private idleCheckInterval: NodeJS.Timeout | null;
    private activeTaskKey: string | null;
    private idlePeriods: IdlePeriod[];
    private notificationShown: boolean = false;
    private dialogShown: boolean = false;
    private currentDialog: Electron.MessageBoxReturnValue | null = null;
    private isInitialized: boolean = false;
    private db: Database | null = null;
    private stmt: any = null;

    constructor(private apiEndpoint: string, idleThresholdSeconds: number = 15) {
        this.taskIdleTimes = new Map();
        this.idleThreshold = idleThresholdSeconds;
        this.idleCheckInterval = null;
        this.activeTaskKey = null;
        this.idlePeriods = []
        this.initializeDatabase();
    }

    private async initializeDatabase() {
        try {
            const dbDir = path.join(app.getPath('userData'), 'db');
            await this.ensureDirectoryExists(dbDir);
            const dbPath = path.join(dbDir, 'idletracking.db');

            this.db = new Database(dbPath);
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS idle_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER,
                    task_id INTEGER,
                    start_time TEXT,
                    end_time TEXT
                )
            `).run();

            // Prepare the statement once and store it
            this.stmt = this.db.prepare(`
                INSERT INTO idle_entries (project_id, task_id, start_time, end_time)
                VALUES (?, ?, ?, ?)
            `);
        } catch (error) {
            console.error('Failed to initialize database:', error);
        }
    }

    private showIdleNotification(systemIdleTime) {
        const notification = new Notification({
            title: 'System Idle Alert',
            body: `Your system has been idle for ${systemIdleTime} seconds.`,
            silent: false, // Set to true if you don't want sound 
        });

        notification.show();
        setTimeout(() => {
            if (notification) {
                notification.close();
            }
        }, 3000);

    }

    private async showIdleDialog(systemIdleTime: number) {
        if (this.dialogShown) return;

        this.dialogShown = true;

        // Show the dialog
        const dialogPromise = dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'System Idle Alert',
            message: `Your system has been idle for ${systemIdleTime} seconds.`,
            buttons: [], // No buttons
            noLink: true
        });

        // Set up auto-close timer
        setTimeout(async () => {
            if (this.currentDialog) {
                // Close the dialog if it's still open
                mainWindow.webContents.send('close-dialog');
            }
            this.dialogShown = false;
            this.currentDialog = null;
        }, 3000);

        // Store the current dialog
        this.currentDialog = await dialogPromise;
    }
    private showIdleNotificationAndStopTimer(systemIdleTime) {
        const notification = new Notification({
            title: 'System Idle Alert',
            body: `Your system has been idle for ${systemIdleTime} seconds.`,
            silent: false, // Set to true if you don't want sound 
        });

        notification.show();
        mainWindow.webContents.send('trigger-timer-toggle');
        setTimeout(() => {
            if (notification) {
                notification.close();
            }
        }, 3000);

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

    private getTaskKey(projectId: number, taskId: number): string {
        return `${projectId}-${taskId}`;
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

    async startTracking(projectId: number, taskId: number) {
        const taskKey = this.getTaskKey(projectId, taskId);

        // If switching to a new task, update activeTaskKey
        if (this.activeTaskKey !== taskKey) {
            this.activeTaskKey = taskKey;
        }

        // Initialize task idle state if it does not exist
        if (!this.taskIdleTimes.has(taskKey)) {
            this.taskIdleTimes.set(taskKey, {
                taskId,
                projectId,
                totalIdleTime: 0,
                isIdle: false,
            });
        }

        // Start idle check interval if not already running
        if (!this.idleCheckInterval) {
            this.idleCheckInterval = setInterval(() => {
                const idleTime = powerMonitor.getSystemIdleTime();
                this.updateIdleTime(idleTime);
            }, 1000); // Check every second
        }
    }

    private updateIdleTime(systemIdleTime: number) {
        if (!this.activeTaskKey) return;

        const activeTaskState = this.taskIdleTimes.get(this.activeTaskKey);
        if (!activeTaskState) return;

        const wasIdle = activeTaskState.isIdle;
        const isNowIdle = systemIdleTime >= this.idleThreshold;

        console.log(systemIdleTime, this.idleThreshold)
        if ((systemIdleTime % 300 === 0) && systemIdleTime !== 0) {
            this.showIdleNotification(systemIdleTime);
            // this.showIdleDialog(systemIdleTime);
        }
        // if ((systemIdleTime % 900 === 0) && systemIdleTime !== 0) {
        //     this.showIdleNotificationAndStopTimer(systemIdleTime)
        // }


        if (!isNowIdle && !!activeTaskState.endTime) {
            this.stmt.run(activeTaskState.projectId, activeTaskState.taskId, activeTaskState.startTime, activeTaskState.endTime)
            this.idlePeriods.push({
                project_id: activeTaskState.projectId,
                task_id: activeTaskState.taskId,
                start_time: activeTaskState.startTime,
                end_time: activeTaskState.endTime
            })
            delete activeTaskState.endTime
        }

        if (systemIdleTime === 0 || systemIdleTime === 1) {
            activeTaskState.startTime = getLocalTime();
        }

        if (isNowIdle) {
            if (!wasIdle) {
                // Just became idle
                activeTaskState.isIdle = true;
            }
            // Add one second to total idle time
            activeTaskState.totalIdleTime += 1;
            activeTaskState.endTime = getLocalTime();
        } else if (wasIdle) {
            // Just became active
            activeTaskState.isIdle = false;
        }
    }

    async stopTracking(projectId: number, taskId: number): Promise<number> {
        const taskKey = this.getTaskKey(projectId, taskId);
        console.log("task Key : ", taskKey)
        const taskState = this.taskIdleTimes.get(taskKey);
        console.log("taskState : ", taskState)
        if (taskState) {
            const totalIdleTime = taskState.totalIdleTime;
            this.taskIdleTimes.delete(taskKey);

            // Clear interval if no more tasks are being tracked
            if (this.taskIdleTimes.size === 0 && this.idleCheckInterval) {
                clearInterval(this.idleCheckInterval);
                this.idleCheckInterval = null;
            }

            // Reset activeTaskKey if this task was active
            if (this.activeTaskKey === taskKey) {
                this.activeTaskKey = null;
            }

            const transformedIdlePeriods = this.idlePeriods.map(period => {
                if (period.task_id === -1) {
                    // Destructure the period and omit task_id when it's -1
                    const { task_id, ...periodWithoutTaskId } = period;
                    return periodWithoutTaskId;
                }
                return period;
            });
            console.log("transformed : ", transformedIdlePeriods)
            if (this.idlePeriods.length > 0) {
                // const res = await fetch(this.apiEndpoint, {
                //     method: 'POST',
                //     headers: this.getAuthHeaders(),
                //     body: JSON.stringify({
                //         "idle_time": transformedIdlePeriods

                //     })
                // });

                // const { message, data } = await res.json()
                // console.log("idle time api : ", message, data)
                this.idlePeriods = []
            }

            return totalIdleTime;
        }

        return;
    }

    getIdleTime(projectId: number, taskId: number): { totalIdleTime: number; isIdle: boolean } {
        const taskKey = this.getTaskKey(projectId, taskId);
        const taskState = this.taskIdleTimes.get(taskKey);

        if (taskState) {
            return {
                totalIdleTime: taskState.totalIdleTime,
                isIdle: taskState.isIdle,
            };
        }

        return { totalIdleTime: 0, isIdle: false };
    }

    clearAll() {
        if (this.idleCheckInterval) {
            clearInterval(this.idleCheckInterval);
            this.idleCheckInterval = null;
        }
        this.taskIdleTimes.clear();
        this.activeTaskKey = null;
    }
}