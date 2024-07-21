// components/AuthClientComponent.tsx
"use client";

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const AuthClientComponent = () => {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
        //TODO: proppoer redirect
      router.push('/actual_app');
    } else {
      router.push('/');
    }
  }, [session, router]);

  return null; // This component does not render any UI
};

export default AuthClientComponent;
