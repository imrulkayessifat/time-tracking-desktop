import { create } from 'zustand'

interface ProjectState {
    project_id: number | null;
    task_id: number | null;
    setProject: (project_id: number, task_id: number) => void;
}


export const useSelectProject = create<ProjectState>((set) => ({
    project_id: -1,
    task_id: -1,
    setProject: (project_id: number, task_id: number) => set({ project_id, task_id }),
}))