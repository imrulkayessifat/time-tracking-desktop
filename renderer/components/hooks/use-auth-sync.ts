// renderer/lib/hooks/use-auth-sync.ts
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

export const useAuthSync = () => {
    const { data: session } = useSession();

    useEffect(() => {
        if (session?.accessToken) {
            // Send token to main process
            window.electron.ipcRenderer.send('update-auth-token', session.accessToken);
        }
    }, [session]);
};