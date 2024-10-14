import NextAuth from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
    interface User {
        id: number;
        name: string;
        email: string;
        role_id: number;
        token: string; // Add token to the User type
    }

    interface Session {
        user: {
            id: number;
            role_id: number;
            email: string;
        };
        accessToken: string; // Add accessToken to the Session type
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: number;
        role_id: number;
        accessToken: string; // Add accessToken to the JWT type
    }
}
