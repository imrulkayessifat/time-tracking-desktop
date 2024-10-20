import { create } from 'zustand'

interface TaskState {
    id: number | null;
    setTaskId: (id: number) => void;
}


export const useSelectTask = create<TaskState>((set) => ({
    id: -1,
    setTaskId: (id) => set({ id: id }),
}))