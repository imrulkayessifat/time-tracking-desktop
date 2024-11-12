// hooks/use-auth.ts
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { getClientSideUser } from '../../lib/auth';

interface UseAuthOptions {
    requireAuth?: boolean;
    redirectTo?: string;
}

interface AuthState {
    isLoading: boolean;
    token: string | null;
    session: any | null;
}

export function useAuth({ requireAuth = false, redirectTo = null }: UseAuthOptions = {}) {
    const router = useRouter();
    const [authState, setAuthState] = useState<AuthState>({
        isLoading: true,
        token: null,
        session: null
    });

    const checkAuth = useCallback(() => {
        try {
            const userData = getClientSideUser();
            const isAuthenticated = !!(userData && userData.session);

            console.log('Auth check:', { isAuthenticated, userData }); // For debugging

            setAuthState({
                isLoading: false,
                token: userData?.token || null,
                session: userData?.session || null
            });

            // Handle redirects based on auth state
            if (requireAuth && !isAuthenticated && redirectTo) {
                console.log('Redirecting to:', redirectTo, '(not authenticated)');
                router.push(redirectTo);
            } else if (!requireAuth && isAuthenticated && redirectTo) {
                console.log('Redirecting to:', redirectTo, '(authenticated)');
                router.push(redirectTo);
            }
        } catch (error) {
            console.error('Auth check error:', error);
            setAuthState({ isLoading: false, token: null, session: null });
        }
    }, [requireAuth, redirectTo, router]);

    useEffect(() => {
        checkAuth();

        // Listen for storage changes
        const handleStorageChange = () => {
            console.log('Storage change detected');
            checkAuth();
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [checkAuth]);

    return authState;
}