import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';

const Search = () => {
    const [owner, setOwner] = useState('');
    const [repo, setRepo] = useState('');
    const [authToken, setAuthToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [color, setColor] = useState('');
    const [logs, setLogs] = useState<string[]>([]); // State for logs
    const router = useRouter();
    const { data: session } = useSession();

    useEffect(() => {
        if (session) {
            setAuthToken(session.accessToken as string);
        }
    }, [session]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (owner && repo && authToken) {
            setIsLoading(true);
            setMessage('');
            setLogs([]); // Clear logs when a new request is made
            try {
                const response = await fetch(
                    `/api/gitfix?owner=${owner}&repo=${repo}&auth=${authToken}`,
                    {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );

                if (response.ok) {
                    const reader = response.body?.getReader();
                    const decoder = new TextDecoder();
                    let logMessages: string[] = [];

                    if (reader) {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            const chunk = decoder.decode(value, { stream: true });
                            const parsedChunk = JSON.parse(chunk);
                            logMessages.push(parsedChunk.message);
                            setLogs(logMessages); // Update logs state
                        }
                    }

                    setColor('green');
                    setMessage('Processing complete.');
                } else {
                    const errorData = await response.json();
                    console.error('Error:', errorData);
                    setMessage(`Error: ${errorData.message}`);
                }
            } catch (error) {
                setColor('red');
                console.error('Error:', error);
                setMessage('An unexpected error occurred.');
            } finally {
                setIsLoading(false);
            }
        } else {
            setMessage(
                'Please enter both owner and repository name, and ensure you are logged in.'
            );
        }
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginTop: '50px',
            }}
        >
            <h1>Enter GitHub Repository</h1>
            <form
                onSubmit={handleSubmit}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <input
                    type="text"
                    placeholder="Owner"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    style={{ margin: '10px', padding: '10px', width: '300px' }}
                />
                <input
                    type="text"
                    placeholder="Repository"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    style={{ margin: '10px', padding: '10px', width: '300px' }}
                />
                <button
                    type="submit"
                    style={{ padding: '10px 20px', marginTop: '20px' }}
                    disabled={isLoading}
                >
                    {isLoading ? 'Processing...' : 'Proceed'}
                </button>
            </form>
            {message && (
                <p
                    style={{
                        marginTop: '20px',
                        color: isLoading ? 'blue' : color,
                    }}
                >
                    {message}
                </p>
            )}
            <button
                onClick={() => signOut({ callbackUrl: '/' })}
                style={{ padding: '10px 20px', marginTop: '20px' }}
            >
                Log Out
            </button>
            <div
                style={{
                    marginTop: '50px',
                    width: '80%',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    backgroundColor: '#f1f1f1',
                    padding: '20px',
                    borderRadius: '5px',
                }}
            >
                {logs.map((log, index) => (
                    <p key={index}>{log}</p>
                ))}
            </div>
        </div>
    );
};

export default Search;
