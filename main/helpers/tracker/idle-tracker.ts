// idle-tracker.ts
import { powerMonitor } from 'electron';

interface TaskIdleTime {
    taskId: number;
    projectId: number;
    startTime?: number;
    endTime?: number;
    totalIdleTime: number;
    isIdle: boolean;
}

export class TaskIdleTracker {
    private taskIdleTimes: Map<string, TaskIdleTime>;
    private idleThreshold: number;
    private idleCheckInterval: NodeJS.Timeout | null;
    private activeTaskKey: string | null;

    constructor(idleThresholdSeconds: number = 60) {
        this.taskIdleTimes = new Map();
        this.idleThreshold = idleThresholdSeconds;
        this.idleCheckInterval = null;
        this.activeTaskKey = null;
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

        if (isNowIdle) {
            if (!wasIdle) {
                // Just became idle
                activeTaskState.isIdle = true;
            }
            // Add one second to total idle time
            activeTaskState.totalIdleTime += 1;
            console.log("idle end Time", new Date(Date.now()).toISOString())
            console.log("idle start Time",new Date(Date.now()-((60+activeTaskState.totalIdleTime)*1000)).toISOString())
        } else if (wasIdle) {
            // Just became active
            activeTaskState.isIdle = false;
        }
    }

    stopTracking(projectId: number, taskId: number): number {
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

            return totalIdleTime;
        }

        return 0;
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
