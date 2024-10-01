// pages/_app.tsx
import { SessionProvider } from 'next-auth/react';
import { ComponentType } from 'react';

interface MyAppProps {
    Component: ComponentType<any>;
    pageProps: {
        session: any; // Specify a better type if possible
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
