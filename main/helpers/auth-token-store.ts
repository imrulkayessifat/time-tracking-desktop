// main/helpers/auth-token-store.ts
import Store from 'electron-store';

interface TokenStore {
    authToken?: string;
}

class AuthTokenStore {
    private store: Store<TokenStore>;
    private static instance: AuthTokenStore;

    private constructor() {
        this.store = new Store<TokenStore>({
            name: 'auth-tokens',
            encryptionKey: 'your-encryption-key-here' // Replace with a secure key
        });
    }

    public static getInstance(): AuthTokenStore {
        if (!AuthTokenStore.instance) {
            AuthTokenStore.instance = new AuthTokenStore();
        }
        return AuthTokenStore.instance;
    }

    public setToken(token: string) {
        this.store.set('authToken', token);
    }

    public getToken(): string | undefined {
        return this.store.get('authToken');
    }

    public clearToken() {
        this.store.delete('authToken');
    }
}

export default AuthTokenStore;