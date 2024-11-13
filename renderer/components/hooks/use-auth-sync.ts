import { useEffect } from 'react';
import { getClientSideUser } from '../../lib/auth';
import { TOKEN_NAME } from '../../lib/auth'; // Import your token name constant

export const useAuthSync = () => {
    useEffect(() => {
        // Get token from cookie
        const userData = getClientSideUser();

        if (userData && userData.token) {
            // Send token to main process through electron IPC
            window.electron.ipcRenderer.send('update-auth-token', userData.token);
        }
    }, []);
};