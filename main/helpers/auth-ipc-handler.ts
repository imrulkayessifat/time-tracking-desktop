import { ipcMain } from 'electron';
import AuthTokenStore from './auth-token-store';

export const setupAuthIPC = () => {
    ipcMain.on('update-auth-token', (_, token: string) => {
        const tokenStore = AuthTokenStore.getInstance();
        tokenStore.setToken(token);
    });

    ipcMain.handle('get-auth-token', () => {
        const tokenStore = AuthTokenStore.getInstance();
        return tokenStore.getToken();
    });
};