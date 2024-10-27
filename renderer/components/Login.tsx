import { useRouter } from 'next/router';
import { FormEvent, useEffect } from "react"
import { useSession } from 'next-auth/react';
import { getSession, signIn } from 'next-auth/react';
import Loader from './Loader';

const Login = () => {
    const router = useRouter();
    const { data: session, status } = useSession();

    useEffect(() => {
        // if (status === 'loading') return;

        if (session) {
            // if (session.user.role_id === 2) {
            router.replace('/profile');
            // } else {
            //     router.replace('/dashboard');
            // }
        }
    }, [session, status, router]);

    if (status === 'loading') {
        return (
            <Loader />
        )
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const formData = new FormData(event.currentTarget)
        const email = formData.get('email')
        const password = formData.get('password')
        const rememberMe = formData.get('rememberMe') === 'on'

        const res = await signIn('credentials', {
            redirect: false,
            email,
            password,
            rememberMe,
        });

        if (res.error) {
            console.error(res.error)
        } else {
            const { user } = await getSession()

            router.push('/profile');

        }

    }
    return (
        <div className='flex items-center justify-center h-screen'>
            {
                !session && (
                    <div className='border rounded-xl border-blue-500 p-8'>
                        <form onSubmit={handleSubmit} className='flex flex-col space-y-4'>
                            <input type="email" name="email" placeholder="Email" required className='border rounded px-3 py-2' />
                            <input type="password" name="password" placeholder="Password" required className='border rounded px-3 py-2' />
                            <div className='flex items-center'>
                                <input type="checkbox" name="rememberMe" id="rememberMe" className='mr-2' />
                                <label htmlFor="rememberMe">Remember me</label>
                            </div>
                            <button type="submit" className='bg-blue-500 text-white rounded px-4 py-2'>Login</button>
                        </form>
                    </div>
                )
            }
        </div>
    )
}

export default Login