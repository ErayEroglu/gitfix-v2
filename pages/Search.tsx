import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useSession, signOut } from 'next-auth/react'

const Search = () => {
    const [owner, setOwner] = useState('')
    const [repo, setRepo] = useState('')
    const [authToken, setAuthToken] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [color, setColor] = useState('')
    const [logs, setLogs] = useState<string[]>([]); // State for logs
    const router = useRouter();
    const { data: session } = useSession();

    useEffect(() => {
        if (session) {
            setAuthToken(session.accessToken as string)
        }
    }, [session])

    useEffect(() => {
        // Set up EventSource for server-sent events
        const eventSource = new EventSource('/api/logs'); // Adjust the endpoint as needed
        eventSource.onmessage = (event) => {
            setLogs((prevLogs) => [...prevLogs, event.data]);
        };
        eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            eventSource.close();
        };
        return () => {
            eventSource.close();
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (owner && repo && authToken) {
            setIsLoading(true)
            setMessage('')
            try {
                const response = await fetch(
                    `/api/gitfix?owner=${owner}&repo=${repo}&auth=${authToken}`,
                    {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                )

                const data = await response.json()
                if (response.ok) {
                    setColor('green')
                    setMessage(data.message)
                } else {
                    console.error('Error:', data)
                    setMessage(`Error: ${data.message}`)
                }
            } catch (error) {
                setColor('red')
                console.error('Error:', error)
                setMessage('An unexpected error occurred.')
            } finally {
                setIsLoading(false)
            }
        } else {
            setMessage(
                'Please enter both owner and repository name, and ensure you are logged in.'
            )
        }
    }

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

            <div style={{ marginTop: '30px', width: '80%' }}>
                <h2>Logs:</h2>
                <div
                    style={{
                        border: '1px solid #ddd',
                        padding: '10px',
                        borderRadius: '4px',
                        backgroundColor: '#f9f9f9',
                        maxHeight: '200px',
                        overflowY: 'auto',
                    }}
                >
                    {logs.map((log, index) => (
                        <p key={index} style={{ margin: '5px 0' }}>
                            {log}
                        </p>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Search
