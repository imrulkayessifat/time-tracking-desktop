import { create } from 'zustand'

interface TaskStatus {
    status: string;
    setStatus: (status: string) => void;
}


export const useSelectStatus = create<TaskStatus>((set) => ({
    status: 'in_progress',
    setStatus: (status: string) => set({ status }),
}))