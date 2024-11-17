// lib/auth.ts
export const TOKEN_NAME = 'auth-token';

export function setClientToken(token: string) {
    try {
        // Remove any existing token
        sessionStorage.removeItem(TOKEN_NAME);
        // Set the new token in sessionStorage
        sessionStorage.setItem(TOKEN_NAME, token);
        // Verify the token was set
        const savedToken = sessionStorage.getItem(TOKEN_NAME);
        console.log('Verification - Saved token:', savedToken);
        // Trigger storage event
        window.dispatchEvent(new Event('storage'));
        return true;
    } catch (error) {
        console.error('Error setting token in sessionStorage:', error);
        return false;
    }
}

export function getClientSideUser() {
    try {
        const token = sessionStorage.getItem(TOKEN_NAME);
        console.log('Retrieved token:', token); // For debugging
        if (!token) return null;
        const payload = token.split('.')[1];
        const session = JSON.parse(atob(payload));
        return { session, token };
    } catch (error) {
        console.error('Error getting user data from sessionStorage:', error);
        return null;
    }
}

export function removeClientToken() {
    try {
        sessionStorage.removeItem(TOKEN_NAME);
        window.dispatchEvent(new Event('storage'));
    } catch (error) {
        console.error('Error removing token from sessionStorage:', error);
    }
}