import { useCallback } from "react";

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

export const useTimerCleanup = () => {
    const getCurrentDate = () => {
        return new Date().toISOString().split('T')[0];
    };

    // Function to check and clean timers
    const cleanupTimers = useCallback(() => {
        try {
            const stored = localStorage.getItem('taskTimers');
            if (!stored) return;

            const currentDate = getCurrentDate();
            const timers: TaskTimerStore = JSON.parse(stored);

            let hasExpiredTimers = false;

            // Check if any timer is from a previous date
            Object.values(timers).forEach((timer) => {
                if (timer.date !== currentDate) {
                    hasExpiredTimers = true;
                }
            });

            // If we found expired timers, clear all timers
            if (hasExpiredTimers) {
                localStorage.removeItem('taskTimers');
                console.log('Cleared all timers due to date change');
            }
        } catch (error) {
            console.error('Error cleaning up timers:', error);
        }
    }, []);

    return { cleanupTimers };

}
