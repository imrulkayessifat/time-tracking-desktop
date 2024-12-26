import { useQuery } from "@tanstack/react-query";

interface UseGetSyncTimeProps {
    token: string;
}

export const useGetSyncTime = ({  token }: UseGetSyncTimeProps) => {
    const query = useQuery({
        queryKey: ["sync_time"],
        queryFn: async () => {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/track/sync`, {
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
    })
    return query;
}