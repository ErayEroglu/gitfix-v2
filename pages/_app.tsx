import { SessionProvider } from 'next-auth/react';
import { ComponentType } from 'react';
import '@/styles/globals.css'  // Change this import path

interface MyAppProps {
    Component: ComponentType<any>;
    pageProps: {
        session: any;
        [key: string]: any;
    };
}

function MyApp({ Component, pageProps }: MyAppProps) {
    return (
        <SessionProvider session={pageProps.session}>
            <Component {...pageProps} />
        </SessionProvider>
    );
}

export default MyApp;