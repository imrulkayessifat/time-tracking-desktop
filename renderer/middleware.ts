import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET });
    const { pathname } = req.nextUrl;

    console.log(`Middleware triggered for path: ${pathname}`);
    console.log(`Token present: ${!!token}`);

    if (token) {
        console.log('Token contents:', JSON.stringify(token, null, 2));
    }

    // List of public paths that don't require authentication
    const publicPaths = ['/home', '/api/auth'];

    // If the path is public, allow access without redirection
    if (publicPaths.some(path => pathname.startsWith(path))) {
        console.log('Allowing access to public path');
        return NextResponse.next();
    }

    // If there's no token and the path isn't public, redirect to login
    if (!token) {
        console.log('No token found, redirecting to /home');
        return NextResponse.redirect(new URL('/home', req.url));
    }

    // If we have a token, log the role_id
    console.log(`User role_id: ${token.role_id}`);

    // Define allowed paths for each role
    const allowedPaths = {
        1: ['/dashboard'],
        default: ['/profile']
    };

    // Determine the user's allowed paths
    const userAllowedPaths = allowedPaths[token.role_id as keyof typeof allowedPaths] || allowedPaths.default;

    // If the current path is not allowed for the user's role, redirect
    if (!userAllowedPaths.some(path => pathname.startsWith(path))) {
        const redirectPath = userAllowedPaths[0];
        console.log(`Redirecting to allowed path: ${redirectPath}`);
        return NextResponse.redirect(new URL(redirectPath, req.url));
    }

    // If we've made it here, the user is authenticated and on an allowed path
    console.log('User authenticated and on allowed path');
    return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
    matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}