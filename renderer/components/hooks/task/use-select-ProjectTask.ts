import { create } from 'zustand'

interface ProjectTaskState {
    chosen_project_id: number | null;
    chosen_task_id: number | null;
    setProjectTask: (chosen_project_id: number, chosen_task_id: number) => void;
}


export const useSelectProjectTask = create<ProjectTaskState>((set) => ({
    chosen_project_id: -1,
    chosen_task_id: -1,
    setProjectTask: (chosen_project_id, chosen_task_id) => set({ chosen_project_id, chosen_task_id }),
}))