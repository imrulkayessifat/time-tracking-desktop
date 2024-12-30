import { useRouter } from 'next/router';
import { Dot } from 'react-animated-dots';
import { FormEvent, useState, useEffect } from "react"

import Loader from './Loader';
import { cn } from '../lib/utils';
import { setClientToken } from '../lib/auth';
import { useAuth } from './hooks/use-auth';

const Login = () => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(' ');
    const { isLoading: authLoading, token } = useAuth({
        requireAuth: false,      // This page doesn't require authentication
        redirectTo: '/profile'   /// Redirect to profile if authenticated
    });

    useEffect(() => {
        window.electron.ipcRenderer.send('toggle-expand', true);
    }, [])

    if (authLoading) {
        return <Loader />;
    }


    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsLoading(true);
        setError(' ');

        const formData = new FormData(event.currentTarget)
        const email = formData.get('email')
        const password = formData.get('password')
        const rememberMe = true

        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password,
                rememberMe: rememberMe
            })
        })

        console.log(response.ok)

        if (!response.ok) {
            return null
        }

        const { data, success } = await response.json()
        console.log("success", success)
        setIsLoading(false);
        if (!success) {

            setError('Invalid email or password.');

        } else {
            window.electron.ipcRenderer.send('permission-check')
            const success = setClientToken(data.token);
            if (!success) {
                throw new Error('Failed to set authentication cookie');
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            localStorage.setItem('user', JSON.stringify(data));
            router.push('/profile');
        }

    }
    return (
        <>
            {
                !token && (
                    <div className='flex pt-[120px] h-screen'>
                        <div className='w-full min-w-[320px] h-[340px]'>
                            <div className='flex flex-col gap-8 items-center p-[30px]'>
                                <img src='/Logo.png' />
                                <form onSubmit={handleSubmit} className='flex flex-col space-y-6'>
                                    <div className='flex flex-col gap-4'>
                                        <div>
                                            <p className='text-base leading-5 font-normal text-red-500 text-left'>
                                                <span>{error}</span>
                                            </p>
                                        </div>
                                        <div className='flex flex-col gap-1'>
                                            <span className='text-base leading-5 font-normal'>Email*</span>
                                            <input disabled={isLoading} type="email" name="email" placeholder="Enter your email" required className='border rounded-[6px] px-3 py-2 w-full min-w-[320px] h-[42px]' />
                                        </div>
                                        <div className='flex flex-col gap-1'>
                                            <span className='text-base leading-5 font-normal'>Password*</span>
                                            <input disabled={isLoading} type="password" name="password" placeholder="Enter password" required className='border rounded-[6px] px-3 py-2 w-full min-w-[320px] h-[42px]' />
                                            <p className='text-[#294DFF] text-right mt-[10px] underline'>
                                                <a href="">Forget password</a>
                                            </p>
                                        </div>
                                    </div>
                                    <div className='w-full'>
                                        {/* <div className='flex items-center mb-2'>
                                            <input disabled={isLoading} type="checkbox" name="rememberMe" id="rememberMe" className='mr-2' />
                                            <label htmlFor="rememberMe">Remember me</label>
                                        </div> */}
                                        <button disabled={isLoading} type="submit" className={cn('w-full text-base leading-5 font-normal bg-[#294DFF] text-white rounded-[30px] px-4 py-4', isLoading && 'bg-[#62BA47]')}>
                                            {
                                                isLoading ? (
                                                    <span>
                                                        Login into in
                                                        <Dot>.</Dot>
                                                        <Dot>.</Dot>
                                                        <Dot>.</Dot>
                                                    </span>
                                                ) : (
                                                    <span>Let's Go</span>
                                                )
                                            }
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    )
}

export default Login
