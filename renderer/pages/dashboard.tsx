import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { signOut } from "next-auth/react";
import { useRouter } from 'next/router';

const Dashboard = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    if (!session) {
        return <ClientSideRedirect />;
    }
    return (
        <div>
            <button
                onClick={() => {
                    signOut();
                    router.push('/home')
                }}
            >
                Sign Out
            </button>
        </div>
    )
}

const ClientSideRedirect = dynamic(() => import('../components/hooks/ClientSideRedirect'), { ssr: false });

export default Dashboard