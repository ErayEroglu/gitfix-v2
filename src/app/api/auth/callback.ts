// src/app/api/auth/callback.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { setCookie } from 'cookies-next';
import dotenv from 'dotenv';

dotenv.config();

async function getAuthTokenFromCode(code: string): Promise<string> {
    const clientId = process.env.GITHUB_APP_CLIENT_ID as string;
    const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET as string;

    const params = {
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
    };

    const response = await fetch(
        'https://github.com/login/oauth/access_token?' + new URLSearchParams(params),
        {
            method: 'POST',
            headers: {
                accept: 'application/json',
            },
        }
    );

    const data = await response.json();
    if (!data.access_token) {
        throw new Error('Failed to obtain access token');
    }

    return data.access_token;
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
    const { code, state } = req.query;
    // Verify state parameter if you use it
    if (!code || typeof code !== 'string') {
        return res.status(400).send('Invalid request');
    }

    // Exchange the code for an access token
    try {
        const accessToken = await getAuthTokenFromCode(code);
        // Save the access token in a cookie or session
        setCookie('session-id', accessToken, { req, res });
        res.redirect('/'); // Redirect to your desired page
    } catch (error) {
        res.status(500).send('Authentication failed');
    }
};
