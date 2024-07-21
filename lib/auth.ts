// import { NextAuthOptions, User, getServerSession } from "next-auth";
// import { useSession } from "next-auth/react";
// import { redirect, useRouter } from "next/navigation";
// import GithubProvider from "next-auth/providers/github";

// export const authConfig: NextAuthOptions = {
//   providers: [
//     GithubProvider({
//       clientId: process.env.GITHUB_CLIENT_ID as string,
//       clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
//     }),
//   ],
// };

// export async function loginIsRequiredServer() {
//   const session = await getServerSession(authConfig);
//   console.log("Trying to login");
//   if (!session) return redirect("/");
// }

// export function loginIsRequiredClient() {
//   if (typeof window !== "undefined") {
//     const session = useSession();
//     const router = useRouter();
//     console.log("Trying to login client");
//     if (!session) router.push("/");
//   }
// }


// lib/auth.ts
import { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { redirect } from "next/navigation";

export const authConfig: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,      
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      return baseUrl;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  }
};


// The below functions should only be used server-side
import { getServerSession } from "next-auth";

export async function loginIsRequiredServer() {
  const session = await getServerSession(authConfig);
  console.log("Trying to login");
  if (!session) return redirect("/");
}
