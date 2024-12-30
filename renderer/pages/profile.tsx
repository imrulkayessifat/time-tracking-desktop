import dynamic from 'next/dynamic';

import Loader from '../components/Loader';
import Main from '../components/Main';
import { useAuth } from '../components/hooks/use-auth';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getClientSideUser } from '../lib/auth';
import { useAuthSync } from '../components/hooks/use-auth-sync';
import { getCurrentTime } from '../lib/utils';

const ProfilePage = () => {
    const router = useRouter();
    const [authState, setAuthState] = useState({
        isLoading: true,
        token: null
    });
    useAuthSync();
    useEffect(() => {
        const checkAuth = () => {
            const userData = getClientSideUser();

            if (!userData || !userData.session) {
                router.push('/home');
                return;
            }

            setAuthState({
                isLoading: false,
                token: userData.token
            });
        };

        checkAuth();
    }, [router]);

    if (authState.isLoading) {
        return <Loader />;
    }

    if (!authState.token) {
        return null;
    }
    localStorage.setItem('time_data', getCurrentTime())
    return <Main token={authState.token} />;

}

export default ProfilePage