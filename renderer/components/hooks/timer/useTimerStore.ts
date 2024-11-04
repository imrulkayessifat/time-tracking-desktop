import { create } from 'zustand'
import { toast } from "sonner"

interface TimerState {
    startTask: (projectId: number, taskId: number, token: string) => Promise<void>
    pauseTask: (projectId: number, taskId: number, token: string) => Promise<void>
}

export const useTimerStore = create<TimerState>((set, get) => ({
    startTask: async (projectId: number, taskId: number, token: string) => {
        if (window.electron) {
            window.electron.ipcRenderer.send('idle-started', { projectId, taskId });
        }

        const requestBody = taskId === -1
            ? { project_id: projectId }
            : { project_id: projectId, task_id: taskId };

        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/track/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${token}`
            },
            body: JSON.stringify(requestBody)
        });

        const { success } = await res.json();
        if (!success) {
            toast.error(`Track Start : Something went wrong ${projectId} ${taskId}`, {
                duration: 1000,
            });
            return;
        }

        toast.success(`Task track started : ${projectId} ${taskId}`, {
            duration: 1000,
        });
    },

    pauseTask: async (projectId: number, taskId: number, token: string) => {
        if (window.electron) {
            window.electron.ipcRenderer.send('idle-stopped', { projectId, taskId });
        }

        const requestBody = taskId === -1
            ? { project_id: projectId }
            : { project_id: projectId, task_id: taskId };

        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/track/pause`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${token}`
            },
            body: JSON.stringify(requestBody)
        });

        const { success } = await res.json();
        if (!success) {
            toast.error(`Track Pause Something went wrong ${projectId} ${taskId}`, {
                duration: 1000,
            });
            return;
        }

        toast.success(`Task track paused : ${projectId} ${taskId}`, {
            duration: 1000,
        });
    }
}));