import { create } from 'zustand'

interface ProjectTaskState {
    init_project_id: number | null;
    init_task_id: number | null;
    setProjectTask: (init_project_id: number, init_task_id: number) => void;
}


export const useSelectProjectTask = create<ProjectTaskState>((set) => ({
    init_project_id: -1,
    init_task_id: -1,
    setProjectTask: (init_project_id, init_task_id) => set({ init_project_id, init_task_id }),
}))