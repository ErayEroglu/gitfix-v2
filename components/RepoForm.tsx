import { useState } from 'react'

type RepoFormProps = {
    onFetchRepo: (owner: string, repo: string) => void
}

const RepoForm = ({ onFetchRepo }: RepoFormProps) => {
    const [owner, setOwner] = useState('')
    const [repo, setRepo] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onFetchRepo(owner, repo)
    }

    return (
        <form onSubmit={handleSubmit}>
            <div>
                <label>Owner:</label>
                <input
                    type="text"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                />
            </div>
            <div>
                <label>Repo:</label>
                <input
                    type="text"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                />
            </div>
            <button type="submit">Fetch Repo</button>
        </form>
    )
}

export default RepoForm
