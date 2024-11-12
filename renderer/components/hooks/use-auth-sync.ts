import { useEffect } from 'react';
import Cookies from 'js-cookie';
import { TOKEN_NAME } from '../../lib/auth'; // Import your token name constant

export const useAuthSync = () => {
    useEffect(() => {
        // Get token from cookie
        const token = Cookies.get(TOKEN_NAME);

        if (token) {
            // Send token to main process through electron IPC
            window.electron.ipcRenderer.send('update-auth-token', token);
        }
    }, []);
};