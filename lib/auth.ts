import { NextAuthOptions } from 'next-auth'
import NextAuth from 'next-auth'
import { getServerSession } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import { redirect } from 'next/navigation'

export const authConfig: NextAuthOptions = {
    providers: [
        GithubProvider({
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        }),
    ],
    session: {
        strategy: 'jwt',
    },
    callbacks: {
        async session({ session, token }) {
            session.accessToken = token.accessToken as string
            return session
        },
        async jwt({ token, user, account }) {
            if (account) {
                token.accessToken = account.access_token
            }
            return token
        },
    },
}

export async function loginIsRequiredServer() {
    const session = await getServerSession(authConfig)
    console.log('Trying to login')
    if (!session) return redirect('/')
}
