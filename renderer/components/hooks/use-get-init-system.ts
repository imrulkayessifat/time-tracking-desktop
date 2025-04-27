// hooks/timer/useGetInitSystem.ts
import { useQuery } from '@tanstack/react-query';

interface InitSystemData {
  success: boolean,
  data: any,
  message : string
}

interface UseGetInitSystemProps {
  token: string;
}

export const useGetInitSystem = ({ token }: UseGetInitSystemProps) => {
  return useQuery<InitSystemData>({
    queryKey: ['init-system'],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/init-system`, {
        method: 'GET',
        headers: {
          'Authorization': token,
        },
      });

      if (res.status === 401) {
        throw new Error('Unauthorized');
      }

      const spec = await res.json();
      console.log("spec : ",spec)
      return spec;
    },
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 72 * 60 * 60 * 1000,
    retry: 1,
  });
};
