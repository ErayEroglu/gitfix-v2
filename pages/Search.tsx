import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'

const Search = () => {
    const [owner, setOwner] = useState('')
    const [repo, setRepo] = useState('')
    const [authToken, setAuthToken] = useState('')
    const [branchName, setBranchName] = useState('your-branch-name')
    const [prTitle, setPrTitle] = useState('Your Pull Request Title')
    const [prBody, setPrBody] = useState('Your Pull Request Body')
    const router = useRouter()
    const { data: session } = useSession()

    useEffect(() => {
        console.log('Session:', session)
        if (session) {
            setAuthToken(session.accessToken as string)
        }
    }, [session])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (owner && repo && authToken) {
            try {
                const response = await fetch('/api/gitfix', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        owner,
                        repo,
                        auth: authToken,
                        branch_name: branchName,
                        pr_title: prTitle,
                        pr_body: prBody,
                    }),
                })

                const data = await response.json()
                if (response.ok) {
                    console.log('Success:', data)
                    router.push(`/actual_app?owner=${owner}&repo=${repo}`)
                } else {
                    console.error('Error:', data)
                    alert(`Error: ${data.message}`)
                }
            } catch (error) {
                console.error('Error:', error)
                alert('An unexpected error occurred.')
            }
        } else {
            console.log(owner,repo,authToken)
            alert('Please enter both owner and repository name, and ensure you are logged in.')
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
                <input
                    type="text"
                    placeholder="Branch Name"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    style={{ margin: '10px', padding: '10px', width: '300px' }}
                />
                <input
                    type="text"
                    placeholder="Pull Request Title"
                    value={prTitle}
                    onChange={(e) => setPrTitle(e.target.value)}
                    style={{ margin: '10px', padding: '10px', width: '300px' }}
                />
                <input
                    type="text"
                    placeholder="Pull Request Body"
                    value={prBody}
                    onChange={(e) => setPrBody(e.target.value)}
                    style={{ margin: '10px', padding: '10px', width: '300px' }}
                />
                <button
                    type="submit"
                    style={{ padding: '10px 20px', marginTop: '20px' }}
                >
                    Proceed
                </button>
            </form>
        </div>
    )
}

export default Search
