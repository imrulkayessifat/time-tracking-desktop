import { create } from 'zustand'

interface TaskState {
    id: number | null;
    project_id: number | null;
    setTask: (id: number, project_id: number) => void;
}


export const useSelectTask = create<TaskState>((set) => ({
    id: -1,
    project_id: -1,
    setTask: (id, project_id) => set({ id, project_id }),
}))