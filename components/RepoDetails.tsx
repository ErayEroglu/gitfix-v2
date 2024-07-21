type RepoDetailsProps = {
    repoData: any
}

const RepoDetails = ({ repoData }: RepoDetailsProps) => {
    return (
        <div>
            <h2>Repository Details</h2>
            <p>
                <strong>Full Name:</strong> {repoData.full_name}
            </p>
            <p>
                <strong>Description:</strong> {repoData.description}
            </p>
            <p>
                <strong>Stars:</strong> {repoData.stargazers_count}
            </p>
            <p>
                <strong>Forks:</strong> {repoData.forks_count}
            </p>
            <p>
                <strong>Open Issues:</strong> {repoData.open_issues_count}
            </p>
        </div>
    )
}

export default RepoDetails
