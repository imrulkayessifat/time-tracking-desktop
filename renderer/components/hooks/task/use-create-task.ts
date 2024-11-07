import { useMutation, useQueryClient } from "@tanstack/react-query";

interface UseCreateTaskProps {
    name: string;
    project_id: number;
    description: string
}

interface UseCreateTaskProp {
    token?: string;
}

export const useCreateTask = ({ token }: UseCreateTaskProp) => {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (data: UseCreateTaskProps) => {
            const req = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/task`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `${token}`
                },
                body: JSON.stringify({
                    ...data
                })
            })
            const res = await req.json()
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] })
        },
        onError: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] })
        }
    })
    return mutation;
}