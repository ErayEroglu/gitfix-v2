import NextAuth, { DefaultSession, DefaultJWT } from 'next-auth'

declare module 'next-auth' {
    interface Session {
        accessToken?: string
    }

    interface JWT extends DefaultJWT {
        accessToken?: string
    }
}
