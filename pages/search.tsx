import { useState, useEffect } from 'react'

const Search = () => {
    const [url, setUrl] = useState('');
    const [owner, setOwner] = useState('')
    const [repo, setRepo] = useState('')
    const [filePath, setFilePath] = useState('')
    // const [authToken, setAuthToken] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [color, setColor] = useState('')
    const [logs, setLogs] = useState<string[]>([]) 
    const [polling, setPolling] = useState(false) 
    const [requestId, setRequestId] = useState<string | null>(null)

    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null
        if (polling) {
            intervalId = setInterval(async () => {
                try {
                    const response = await fetch(`/api/status?id=${owner}@${repo}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    })
                    if (response.ok) {
                        const data = await response.json()
                        console.log('Status:', data)
    
                        if (data.status === 'completed') {
                            setLogs((prevLogs) => [
                                ...prevLogs,
                                'Pull request created, you can check your repository.',
                            ])
                            setPolling(false)
                            setColor('green')
                            setMessage('All files are processed. The pull request has been created.')
                        }
                    } else {
                        console.error('Failed to fetch status:', await response.text())
                    }
                } catch (error) {
                    console.error('Polling error:', error)
                }
            }, 15000) // Adjust the polling interval as needed
        }
    
        return () => {
            if (intervalId) {
                clearInterval(intervalId)
            }
        }
    }, [polling, requestId])
    

    // takes the owner, repo, and authToken as input and sends a GET request to the /api/gitfix route
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const repoInfo = extractRepoInfo(url)
        console.log('Repo Info:', repoInfo)
        if (repoInfo) {
            setOwner(repoInfo.owner)    
            setRepo(repoInfo.repo)
            let type = repoInfo.type
            if (!type) {
                setFilePath(repoInfo.filePath as string) 
            }
        }
        console.log('Owner:', owner, 'Repo:', repo, 'Type:', repoInfo?.type,)
        if (owner && repo) {
            setIsLoading(true)
            setMessage('')
            setLogs([])
            try {
                console.log('Filepath:', filePath)
                const endpoint = filePath ? `/api/gitfix?owner=${owner}&repo=${repo}&type=${repoInfo?.type}&filePath=${filePath}` : `/api/gitfix?owner=${owner}&repo=${repo}&type=${repoInfo?.type}`
                const response = await fetch(
                    endpoint,
                    {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                )
    
                if (response.ok) {
                    setPolling(true)
                    const reader = response.body?.getReader()
                    const decoder = new TextDecoder()
                    let accumulatedData = ''
    
                    if (reader) {
                        while (true) {
                            const { done, value } = await reader.read()
                            if (done) break
    
                            accumulatedData += decoder.decode(value, {
                                stream: true,
                            })
    
                            // Splitting the accumulated data into complete JSON objects
                            const messages = accumulatedData.split('#').filter(Boolean)
    
                            messages.forEach((message) => {
                                try {
                                    const parsedData = JSON.parse(message)
                                    setLogs((prevLogs) => [
                                        ...prevLogs,
                                        parsedData.message,
                                    ])
                                } catch (parseError) {
                                    console.warn('Parsing error:', parseError)
                                }
                            })
    
                            // Clear accumulated data after processing
                            accumulatedData = ''
                        }
                    }
                    setColor('green')
                    setMessage('Repository analysis completed, we are starting to process markdown files.')
                } else {
                    const errorData = await response.json()
                    console.error('Error:', errorData)
                    setMessage(`Error: ${errorData.message}`)
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
                'Please check the link'
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
            <h1>GITFIX</h1>
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
                    placeholder="Please enter the repository name or file URL" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    style={{ margin: '10px', padding: '10px', width: '300px' }}
                />
                <button
                    type="submit"
                    style={{ padding: '10px 20px', marginTop: '20px' }}
                    disabled={isLoading}
                >
                    {isLoading ? 'Processing...' : 'Submit'}
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
            {logs.length > 0 && (
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
            )}
        </div>
    )
}
export default Search


function extractRepoInfo(url: string): { owner: string; repo: string; type: 0 | 1; filePath?: string } | null {
    const cleanedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const urlParts = cleanedUrl.split('/');
    console.log('URL parts:', urlParts)

    if (urlParts.length === 5 && urlParts[2] === 'github.com') {
        const owner = urlParts[3];
        const repo = urlParts[4];
        return { owner, repo, type: 1 };  // Repo URL identified
    }

    if (urlParts.length > 5 && urlParts[2] === 'github.com' && urlParts[5] === 'blob') {
        const owner = urlParts[3];
        const repo = urlParts[4];
        const filePath = urlParts.slice(7).join('/');
        return { owner, repo, type: 0, filePath };  // File URL identified
    }

    return null;
}