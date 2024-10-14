import { FormEvent } from "react"
import { signIn } from 'next-auth/react';

const Login = () => {
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

    }
    return (
        <div className='flex items-center justify-center h-screen'>
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
        </div>
    )
}

export default Login