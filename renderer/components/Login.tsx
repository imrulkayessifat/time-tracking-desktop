import { useRouter } from 'next/router';
import { Dot } from 'react-animated-dots';
import { FormEvent, useState } from "react"
import { useSession } from 'next-auth/react';
import { getSession, signIn } from 'next-auth/react';

import Loader from './Loader';
import { cn } from '../lib/utils';

const Login = () => {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(' ');

    if (status === 'loading') {
        return (
            <Loader />
        )
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsLoading(true);
        setError(' ');

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

        setIsLoading(false);
        console.log("res : ", res)
        if (res.error) {
            if (res.error === 'CredentialsSignin') {
                setError('Invalid email or password.');
            } else if (res.error === 'NetworkError') {
                setError('Network error occurred.');
            } else {
                setError('An unexpected error occurred. Please try again later.');
            }
        } else {
            const { user } = await getSession()

            router.push('/profile');

        }

    }
    return (
        <div className='flex items-center justify-center h-screen'>
            {
                !session && (
                    <div className='w-[540px] h-[412px]'>
                        <div className='flex flex-col gap-8 items-center justify-center p-[30px]'>
                            <img src='/Logo.png' />
                            <form onSubmit={handleSubmit} className='flex flex-col space-y-6'>
                                <div className='flex flex-col gap-4'>
                                    <div>
                                        <p className='text-base leading-5 font-normal text-red-500 text-left'>
                                            <span>{error}</span>
                                        </p>
                                    </div>
                                    <div>
                                        <span className='text-base leading-5 font-normal'>Email*</span>
                                        <input disabled={isLoading} type="email" name="email" placeholder="Enter your email" required className='border rounded-[6px] px-3 py-2 w-[480px] h-[42px]' />
                                    </div>
                                    <div>
                                        <span className='text-base leading-5 font-normal'>Password*</span>
                                        <input disabled={isLoading} type="password" name="password" placeholder="Enter password" required className='border rounded-[6px] px-3 py-2 w-[480px] h-[42px]' />
                                        <p className='text-[#294DFF] text-right mt-[10px] underline'>
                                            <a href="">Forget password</a>
                                        </p>
                                    </div>
                                </div>
                                <div className='w-full'>
                                    <div className='flex items-center mb-2'>
                                        <input disabled={isLoading} type="checkbox" name="rememberMe" id="rememberMe" className='mr-2' />
                                        <label htmlFor="rememberMe">Remember me</label>
                                    </div>
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
                )
            }
        </div>
    )
}

export default Login