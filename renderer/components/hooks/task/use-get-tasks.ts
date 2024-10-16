import { useQuery } from "@tanstack/react-query";

interface UseGetTaskProps {
    taskPage: number;
    projectId: number;
    token: string;
}

interface TaskData {
    rows: any[];
    meta: {
        total_records: number;
        current_page: number;
        total_pages: number;
    };
}

export const useGetTasks = ({ taskPage, token, projectId }: UseGetTaskProps) => {
    const query = useQuery<TaskData>({
        queryKey: ["tasks", taskPage, projectId],
        queryFn: async () => {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/task/project/${projectId}?page=${taskPage}&limit=5`, {
                method: 'GET',
                headers: {
                    'Authorization': `${token}`,
                }
            });
            if (!res.ok) {
                throw new Error("Failed to fetch tasks");
            }
            const { data } = await res.json();
            console.log(data)
            return data;
        },
    })
    return query;
}