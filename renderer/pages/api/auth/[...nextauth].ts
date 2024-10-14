import NextAuth from 'next-auth';
import { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';

export default NextAuth({
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: "email", type: "text" },
                password: { label: "password", type: "password" },
                rememberMe: { label: "rememberMe", type: "checkbox" }
            },
            async authorize(credentials, req) {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: credentials.email,
                        password: credentials.password,
                        rememberMe: credentials.rememberMe
                    })
                })

                if (!response.ok) {
                    return null
                }

                const { data } = await response.json()
                const user = data

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role_id: user.role_id,
                    token: user.token,
                };
            }
        })
    ],
    pages: {
        error: '/home',
    },
    callbacks: {
        async signIn({ user, account }) {
            if (!user) return false;

            return true;
        },
        async jwt({ token, user }) {
            // First login - store token in JWT
            if (user) {
                token.id = Number(user.id);
                token.role_id = user.role_id;
                token.accessToken = user.token;  // Store the token here
            }
            return token;
        },
        async session({ session, token }: { session: any, token: JWT }) {
            if (token && session.user) {
                session.user.id = token.id;
                session.user.role_id = token.role_id;
                session.accessToken = token.accessToken;
            }
            console.log("Session in NextAuth config:", session);
            return session;
        },
    },
    secret: process.env.AUTH_SECRET,
    session: {
        strategy: 'jwt',
    },
    jwt: {
        secret: process.env.AUTH_SECRET,
    },
});
