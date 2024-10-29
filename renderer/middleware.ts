import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export const authRoutes = [
    "/home/",
    "/error/",
];

const apiAuthPrefix = "/api/auth";

export async function middleware(req: NextRequest) {
    const isAuthRoute = authRoutes.includes(req.nextUrl.pathname);
    const isApiAuthRoute = req.nextUrl.pathname.startsWith(apiAuthPrefix);

    const token = await getToken({ req, secret: process.env.AUTH_SECRET });
    const { pathname } = req.nextUrl;

    console.log(`Middleware triggered for path: ${pathname}`);
    console.log(`Token present: ${!!token}`);

    if (isApiAuthRoute) {
        return;
    }

    if (isAuthRoute) {
        if (!!token) {
            // return Response.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl))
            return Response.redirect(new URL('/profile', req.nextUrl));
        }
        return;
    }

    if (!token) {
        console.log('No token found, redirecting to /home');
        return NextResponse.redirect(new URL('/home', req.nextUrl));
    }

    return;
}

// Matching Paths configuration
export const config = {
    matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}
