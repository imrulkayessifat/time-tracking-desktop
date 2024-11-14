import { useQuery } from "@tanstack/react-query";

interface UseGetProjectProps {
    page: number;
    token: string;
}

interface ProjectData {
    rows: any[];
    meta: {
        total_records: number;
        current_page: number;
        total_pages: number;
    };
}

export const useGetProjects = ({ page, token }: UseGetProjectProps) => {
    const query = useQuery<ProjectData>({
        queryKey: ["projects", page],
        queryFn: async () => {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/project?page=${page}&limit=5&status=active`, {
                method: 'GET',
                headers: {
                    'Authorization': `${token}`,
                }
            });
            if (!res.ok) {
                throw new Error("Failed to fetch projects");
            }
            const { data } = await res.json();
            return data;
        },
        gcTime:0
    })
    return query;
}