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

interface StartTaskResponse {
    success: boolean;
    duration?: string; // "HH:mm:ss" format
}

export const useTaskTimer = (
    taskId: number,
    projectId: number,
    pauseTask?: (projectId: number, taskId: number) => void
) => {
    const parentTaskKey = `task_${projectId}_-1`;
    const taskKey = `task_${projectId}_${taskId}`;

    const getCurrentDate = () => {
        return new Date().toISOString().split('T')[0];
    };

    const parseDuration = (duration: string) => {
        const [hours, minutes, seconds] = duration.split(':').map(Number);
        return { hours, minutes, seconds };
    };

    const getStoredTime = (): TaskTime | null => {
        if (typeof window === 'undefined') return null;
        const stored = localStorage.getItem('taskTimers');
        if (!stored) return null;
        const timers: TaskTimerStore = JSON.parse(stored);
        return timers[taskKey] || null;
    };

    const getStoredTimeParent = (): TaskTime | null => {
        if (typeof window === 'undefined') return null;
        const stored = localStorage.getItem('taskTimers');
        if (!stored) return null;
        const timers: TaskTimerStore = JSON.parse(stored);
        return timers[parentTaskKey] || null;
    };

    const getAllTimers = (): TaskTimerStore => {
        if (typeof window === 'undefined') return {};
        const stored = localStorage.getItem('taskTimers');
        return stored ? JSON.parse(stored) : {};
    };

    const updateParentTaskTime = (currentTimers: TaskTimerStore, taskDuration?: string, isRunning = false) => {
        if (taskId === -1) return;

        const parentTime = currentTimers[parentTaskKey] || {
            hours: 0,
            minutes: 0,
            seconds: 0,
            isRunning,
            date: getCurrentDate()
        };

        if (taskDuration) {
            const { hours, minutes, seconds } = parseDuration(taskDuration);
            parentTime.hours += hours;
            parentTime.minutes += minutes;
            parentTime.seconds += seconds;
        } else {
            parentTime.seconds += 1;
            if (parentTime.seconds >= 60) {
                parentTime.minutes += Math.floor(parentTime.seconds / 60);
                parentTime.seconds = parentTime.seconds % 60;
            }
            if (parentTime.minutes >= 60) {
                parentTime.hours += Math.floor(parentTime.minutes / 60);
                parentTime.minutes = parentTime.minutes % 60;
            }
        }

        parentTime.isRunning = isRunning; // Only set to running if specified
        currentTimers[parentTaskKey] = parentTime;
    };

    const stopRunningTimer = () => {
        const timers = getAllTimers();
        let updated = false;

        Object.entries(timers).forEach(async ([key, timer]) => {
            if (timer.isRunning && key !== taskKey) {
                const [_, projectId, taskId] = key.split('_');
                timer.isRunning = false;
                updated = true;
                await pauseTask(parseInt(projectId), parseInt(taskId))
            }
        });

        if (updated) {
            localStorage.setItem('taskTimers', JSON.stringify(timers));
        }
    };

    const getOffsetDate = (initialDuration?: string) => {
        const now = new Date();
        if (initialDuration) {
            const { hours, minutes, seconds } = parseDuration(initialDuration);
            now.setHours(now.getHours() + hours);
            now.setMinutes(now.getMinutes() + minutes);
            now.setSeconds(now.getSeconds() + seconds);
            return now;
        }

        const storedTime = getStoredTime();
        if (storedTime) {
            now.setHours(now.getHours() + storedTime.hours);
            now.setMinutes(now.getMinutes() + storedTime.minutes);
            now.setSeconds(now.getSeconds() + storedTime.seconds);
        }
        return now;
    };

    const getOffsetDateParent = (initialDuration?: string) => {
        const now = new Date();
        if (initialDuration) {
            const { hours, minutes, seconds } = parseDuration(initialDuration);
            now.setHours(now.getHours() + hours);
            now.setMinutes(now.getMinutes() + minutes);
            now.setSeconds(now.getSeconds() + seconds);
            return now;
        }

        const storedTime = getStoredTimeParent();
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

    useEffect(() => {
        stopRunningTimer();
        const storedTime = getStoredTime();
        if (storedTime) {
            const date = new Date();
            date.setHours(date.getHours() + storedTime.hours);
            date.setMinutes(date.getMinutes() + storedTime.minutes);
            date.setSeconds(date.getSeconds() + storedTime.seconds);
            reset(date, storedTime.isRunning);
        } else {
            const date = new Date();
            reset(date, false);
        }
    }, [taskId, projectId, reset]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const timers = getAllTimers();
        const previousState = timers[taskKey];
        const currentState = {
            hours,
            minutes,
            seconds,
            isRunning,
            date: getCurrentDate()
        };

        timers[taskKey] = currentState;

        if (isRunning &&
            previousState &&
            (previousState.hours !== hours ||
                previousState.minutes !== minutes ||
                previousState.seconds !== seconds)) {
            updateParentTaskTime(timers, undefined, false);
        }

        localStorage.setItem('taskTimers', JSON.stringify(timers));

    }, [hours, minutes, seconds, isRunning, taskKey]);

    const start = useCallback((projectDuration?: string, signal?: boolean, taskDuration?: string) => {
        const timers = getAllTimers();
        console.log("duration : ", projectDuration, taskDuration)
        if (projectDuration) {
            const offsetDateParent = getOffsetDateParent(projectDuration);

            const { hours, minutes, seconds } = parseDuration(projectDuration);
            timers[parentTaskKey] = {
                hours,
                minutes,
                seconds,
                isRunning: false,  // Keep parent task non-running if signal is true
                date: getCurrentDate()
            };

            if (!signal) {
                reset(offsetDateParent, false);
            }
        }

        if (taskDuration && signal) {
            const offsetDate = getOffsetDate(taskDuration);
            reset(offsetDate, true);
        } else {
            startStopwatch();
        }

        localStorage.setItem('taskTimers', JSON.stringify(timers));

    }, [startStopwatch, reset]);

    const pause = useCallback(() => {
        pauseStopwatch();
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
