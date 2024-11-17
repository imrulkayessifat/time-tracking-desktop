import { useQuery } from "@tanstack/react-query";

interface UseGetTaskProps {
    taskPage: number;
    status: string
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

export const useGetTasks = ({ taskPage, token, projectId, status }: UseGetTaskProps) => {
    const query = useQuery<TaskData>({
        queryKey: ["tasks", taskPage, projectId, status],
        queryFn: async () => {

            console.log("ffff", status)
            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/task/project/${projectId}?page=${taskPage}&limit=5&status=${status}`, {
                method: 'GET',
                headers: {
                    'Authorization': `${token}`,
                }
            });
            if (!res.ok) {
                throw new Error("Failed to fetch tasks");
            }
            const { data } = await res.json();
            return data;
        },
        gcTime: 0
    })
    return query;
}