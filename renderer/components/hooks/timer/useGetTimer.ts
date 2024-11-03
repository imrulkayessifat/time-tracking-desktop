import { useState, useEffect } from 'react';

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

export const useGetTimer = () => {
    const [timerStore, setTimerStore] = useState<TaskTimerStore>({});

    useEffect(() => {
        const loadTimers = () => {
            const stored = localStorage.getItem('taskTimers');
            if (stored) {
                setTimerStore(JSON.parse(stored));
            }
        };

        loadTimers();
        const interval = setInterval(loadTimers, 1000);

        return () => clearInterval(interval);
    }, []);

    const getProjectTime = (projectId: number) => {
        const key = `task_${projectId}_-1`;
        const time = timerStore[key];

        return {
            hours: time?.hours || 0,
            minutes: time?.minutes || 0,
            seconds: time?.seconds || 0,
            isRunning: time?.isRunning || false
        };
    };

    const getTaskTime = (projectId: number, taskId: number) => {
        const key = `task_${projectId}_${taskId}`;
        const time = timerStore[key];

        return {
            hours: time?.hours || 0,
            minutes: time?.minutes || 0,
            seconds: time?.seconds || 0,
            isRunning: time?.isRunning || false
        };
    };

    return {
        getProjectTime,
        getTaskTime
    };
};