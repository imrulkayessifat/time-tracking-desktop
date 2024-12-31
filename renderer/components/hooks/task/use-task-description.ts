import { create } from 'zustand'

interface TaskDescription {
    task_description: string | null;
    setTaskDescription: (task_description: string) => void;
}


export const useTaskDescription = create<TaskDescription>((set) => ({
    task_description: '',
    setTaskDescription: (task_description) => set({ task_description }),
}))