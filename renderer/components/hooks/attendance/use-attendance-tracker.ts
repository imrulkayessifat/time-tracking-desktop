import { useState, useEffect } from 'react';

const STORAGE_KEY = 'time_data';
const LAST_SYNC_KEY = 'last_sync_date';

const useAttendanceTracker = ({ token }) => {
    const [isOnline, setIsOnline] = useState(window.navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const getCurrentDate = () => {
        const currentUtcTime = new Date();
        const localTimeOffset = currentUtcTime.getTimezoneOffset() * 60000;
        return new Date(currentUtcTime.getTime() - localTimeOffset).toISOString().split('T')[0];
    };

    const getCurrentTime = () => {
        const currentUtcTime = new Date();
        const localTimeOffset = currentUtcTime.getTimezoneOffset() * 60000;
        return new Date(currentUtcTime.getTime() - localTimeOffset).toISOString().split('T')[1];
    }

    const hasCheckedInToday = () => {
        try {
            const lastSync = localStorage.getItem(LAST_SYNC_KEY);
            const today = getCurrentDate();
            console.log('Last sync:', lastSync, 'Today:', today);
            return lastSync === today;
        } catch (error) {
            console.error('Error checking last sync:', error);
            return false;
        }
    };

    const syncAttendance = async () => {
        console.log('Attempting to sync...', 'Online:', isOnline, 'Already checked in:', hasCheckedInToday());

        if (!isOnline) {
            console.log('Not online, skipping sync');
            return;
        }

        if (hasCheckedInToday()) {
            console.log('Already checked in today, skipping sync...');
            return;
        }
        const time = localStorage.getItem(STORAGE_KEY)
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/track/attendance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `${token}`
                },
                body: JSON.stringify({
                    check_in: time
                })
            });

            console.log('API Response:', await response.json());

            if (response.ok) {
                localStorage.setItem(LAST_SYNC_KEY, getCurrentDate());
                console.log('Successfully marked attendance');
            } else {
                console.error('API call failed:', response.status);
            }
        } catch (error) {
            console.error('Error in sync process:', error);
        }
    };

    // Initial check-in on mount
    useEffect(() => {
        const checkAttendance = async () => {
            console.log('Component mounted, checking attendance...');
            if (!hasCheckedInToday()) {
                console.log('Have not checked in today, attempting sync...');
                await syncAttendance();
            } else {
                console.log('Already checked in today');
            }
        };

        checkAttendance();
    }, []); // Empty dependency array means this runs once on mount

    // Sync when coming online
    useEffect(() => {
        console.log('Online status changed:', isOnline);
        if (isOnline) {
            syncAttendance();
        }
    }, [isOnline]);

    return { isOnline };
};

export default useAttendanceTracker;