// idle-tracker.ts
import { powerMonitor } from 'electron';

import AuthTokenStore from '../auth-token-store';

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

    constructor(private apiEndpoint: string, idleThresholdSeconds: number = 60) {
        this.taskIdleTimes = new Map();
        this.idleThreshold = idleThresholdSeconds;
        this.idleCheckInterval = null;
        this.activeTaskKey = null;
        this.idlePeriods = []
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

    startTracking(projectId: number, taskId: number) {
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

        if (!isNowIdle && !!activeTaskState.endTime) {
            this.idlePeriods.push({
                project_id: activeTaskState.taskId,
                task_id: activeTaskState.projectId,
                start_time: activeTaskState.startTime,
                end_time: activeTaskState.endTime
            })
            delete activeTaskState.endTime
        }

        if (systemIdleTime === 0 || systemIdleTime === 1) {
            activeTaskState.startTime = new Date(Date.now()).toISOString();
        }

        if (isNowIdle) {
            if (!wasIdle) {
                // Just became idle
                activeTaskState.isIdle = true;
            }
            // Add one second to total idle time
            activeTaskState.totalIdleTime += 1;
            activeTaskState.endTime = new Date(Date.now()).toISOString();
        } else if (wasIdle) {
            // Just became active
            activeTaskState.isIdle = false;
        }
    }

    async stopTracking(projectId: number, taskId: number): Promise<number> {
        const taskKey = this.getTaskKey(projectId, taskId);
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

            console.log("idle periods : ", this.idlePeriods)

            if (this.idlePeriods.length > 0) {
                const res = await fetch(this.apiEndpoint, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({
                        "idle_time": this.idlePeriods

                    })
                });

                const { message } = await res.json()
                console.log(message)
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