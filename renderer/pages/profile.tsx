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

    function convertTo12HourFormat(isoTime) {
        // Parse the ISO time string
        const date = new Date(`1970-01-01T${isoTime}`);
    
        // Extract hours, minutes, and seconds
        let hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();
    
        // Determine AM or PM
        const ampm = hours >= 12 ? 'PM' : 'AM';
    
        // Convert to 12-hour format
        hours = hours % 12;
        hours = hours === 0 ? 12 : hours;
    
        // Format the time string with leading zeros for minutes and seconds
        const formattedTime = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${ampm}`;
        return formattedTime;
    }

    if (!authState.token) {
        return null;
    }
    const time = getCurrentTime()
    localStorage.setItem('time_data', convertTo12HourFormat(time))
    return <Main token={authState.token} />;

}

export default ProfilePage