import { create } from 'zustand'

interface ProjectState {
    id: number | null;
    setProjectId: (id: number) => void;
}


export const useSelectProject = create<ProjectState>((set) => ({
    id: -1,
    setProjectId: (id) => set({ id: id }),
}))