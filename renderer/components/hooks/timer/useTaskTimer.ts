import { useEffect, useCallback } from 'react';
import { useStopwatch } from 'react-timer-hook';

interface TaskTime {
    hours: number;
    minutes: number;
    seconds: number;
    isRunning: boolean;
    date: string;
}

interface TaskTimerStore {
    [key: string]: TaskTime;
}

export const useTaskTimer = (
    taskId: number,
    projectId: number,
    pauseTask?: (projectId: number, taskId: number) => void
) => {
    // Create a unique key for the task
    const taskKey = `task_${projectId}_${taskId}`;

    const getCurrentDate = () => {
        return new Date().toISOString().split('T')[0];
    };

    // Get stored time for this task
    const getStoredTime = (): TaskTime | null => {
        if (typeof window === 'undefined') return null;
        const stored = localStorage.getItem('taskTimers');
        if (!stored) return null;
        const timers: TaskTimerStore = JSON.parse(stored);
        return timers[taskKey] || null;
    };

    // Get all stored timers
    const getAllTimers = (): TaskTimerStore => {
        if (typeof window === 'undefined') return {};
        const stored = localStorage.getItem('taskTimers');
        return stored ? JSON.parse(stored) : {};
    };

    // Find and stop any running timer
    const stopRunningTimer = () => {
        const timers = getAllTimers();
        let updated = false;

        Object.entries(timers).forEach(async ([key, timer]) => {
            if (timer.isRunning && key !== taskKey) {
                const [_, projectId, taskId] = key.split('_');
                console.log("isRunning : ", projectId, taskId)
                timer.isRunning = false;
                updated = true;
                await pauseTask(parseInt(projectId), parseInt(taskId))
            }
        });

        if (updated) {
            localStorage.setItem('taskTimers', JSON.stringify(timers));
        }
    };

    // Calculate offset date for the stopwatch
    const getOffsetDate = () => {
        const storedTime = getStoredTime();
        const now = new Date();
        if (storedTime) {
            now.setHours(now.getHours() + storedTime.hours);
            now.setMinutes(now.getMinutes() + storedTime.minutes);
            now.setSeconds(now.getSeconds() + storedTime.seconds);
        }
        return now;
    };

    const {
        seconds,
        minutes,
        hours,
        isRunning,
        start: startStopwatch,
        pause: pauseStopwatch,
        reset
    } = useStopwatch({
        autoStart: false,
        offsetTimestamp: getOffsetDate()
    });

    // Reset timer when switching tasks
    useEffect(() => {
        stopRunningTimer(); // Stop any running timer when switching tasks

        const storedTime = getStoredTime();
        if (storedTime) {
            // If there's stored time, set it
            const date = new Date();
            date.setHours(date.getHours() + storedTime.hours);
            date.setMinutes(date.getMinutes() + storedTime.minutes);
            date.setSeconds(date.getSeconds() + storedTime.seconds);
            reset(date, storedTime.isRunning); // Maintain the running state from storage
        } else {
            // If no stored time, reset to 0
            const date = new Date();
            reset(date, false);
        }
    }, [taskId, projectId, reset]);

    // Save timer state when it changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const timers = getAllTimers();
        timers[taskKey] = {
            hours,
            minutes,
            seconds,
            isRunning,
            date: getCurrentDate()
        };
        localStorage.setItem('taskTimers', JSON.stringify(timers));
    }, [hours, minutes, seconds, isRunning, taskKey]);

    const start = useCallback(() => {
        stopRunningTimer(); // Stop any running timer before starting new one
        startStopwatch();
    }, [startStopwatch]);

    const pause = useCallback(() => {
        pauseStopwatch();
        // Save final time when pausing
        if (typeof window !== 'undefined') {
            const timers = getAllTimers();
            timers[taskKey] = {
                hours,
                minutes,
                seconds,
                isRunning: false,
                date: getCurrentDate()
            };
            localStorage.setItem('taskTimers', JSON.stringify(timers));
        }
    }, [pauseStopwatch, taskKey, hours, minutes, seconds]);

    return {
        seconds,
        minutes,
        hours,
        isRunning,
        start,
        pause
    };
};