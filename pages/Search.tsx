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
                    let accumulatedData = '';
                    let logMessages: string[] = [];

                    if (reader) {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            accumulatedData += decoder.decode(value, { stream: true });

                            // Try parsing the accumulated data
                            try {
                                let data = accumulatedData;
                                let endIndex: number;

                                // Loop to handle multiple JSON objects or incomplete data
                                while (true) {
                                    // Find the end of the JSON object
                                    try {
                                        endIndex = data.indexOf('}\n') + 1;
                                        if (endIndex === 0) break;

                                        // Extract JSON object
                                        const jsonStr = data.substring(0, endIndex);
                                        const parsedData = JSON.parse(jsonStr);

                                        // Update logs
                                        logMessages.push(parsedData.message);
                                        
                                        // Remove the processed JSON object from the data
                                        data = data.substring(endIndex).trim();
                                    } catch (parseError) {
                                        break; // Break if JSON parsing fails
                                    }
                                }

                                // Update accumulatedData with remaining data
                                accumulatedData = data;// Reset accumulated data after successful parse
                            } catch (parseError) {
                                // If parsing fails, continue accumulating data
                                console.warn('Accumulated data not yet complete or valid JSON:', parseError);
                            }
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
        </div>
    );
};

export default Search;
