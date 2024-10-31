import { create } from 'zustand'

interface TaskState {
    chosen_project_id: number | null;
    chosen_task_id: number | null;
    setTask: (chosen_project_id: number, chosen_task_id: number) => void;
}


export const useSelectTask = create<TaskState>((set) => ({
    chosen_project_id: -1,
    chosen_task_id: -1,
    setTask: (chosen_project_id, chosen_task_id) => set({ chosen_project_id, chosen_task_id }),
}))