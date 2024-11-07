import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';

import Loader from '../components/Loader';
import Main from '../components/Main';

const ProfilePage = () => {
    const { data: session, status } = useSession();

    if (!session) {
        return <ClientSideRedirect />;
    }

    console.log("session", session)

    if (status === "loading") {
        return (
            <Loader />
        );
    }
    return (
        <Main token={session.accessToken} />
    );
}

const ClientSideRedirect = dynamic(() => import('../components/hooks/ClientSideRedirect'), { ssr: false });

export default ProfilePage