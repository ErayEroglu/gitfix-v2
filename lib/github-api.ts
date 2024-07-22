const GITHUB_API_VERSION = '2022-11-28'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

export class Github_API {
    owner: string
    repo: string
    auth: string | undefined
    items: any[]
    url: string
    repo_details: any
    md_files_content: any
    updatedItems: string[]
    headers: any

    constructor(owner: string, repo: string, auth: string | undefined) {
        this.owner = owner
        this.repo = repo
        this.auth = auth
        this.items = []
        this.updatedItems = []
        this.md_files_content = {}
        this.url = `https://api.github.com/repos/${this.owner}/${this.repo}`
        this.headers = this.getHeaders()
    }

    async initializeRepoDetails(): Promise<void> {
        this.repo_details = await this.get_repo_details()
    }

    // find the md files and extract the text
    async get_file_content(): Promise<void> {
        await this.get_md_files()
        await this.get_md_file_details()
    }

    // fork the target repo
    async forkRepository(): Promise<any[]> {
        const url = `https://api.github.com/repos/${this.owner}/${this.repo}/forks`
        const headers = this.headers

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(
                `Error forking repository: ${response.status} ${errorData.message}`
            )
        }
        const data = await response.json()
        const forkedOwner = data.owner.login
        const forkedRepo = data.name

        return [forkedOwner, forkedRepo]
    }

    // update the content of the md files and upload it to the forked repo
    async updateFileContent(
        filePath: string,
        content: string,
        forkedOwner: string,
        forkedRepo: string
    ): Promise<void> {
        const item = this.items.find((item) => item.path === filePath)
        if (!item) {
            throw new Error(`File ${filePath} not found in the repository.`)
        }

        const url = `https://api.github.com/repos/${forkedOwner}/${forkedRepo}/contents/${filePath}`
        const headers = this.headers
        const encodedContent = this.encodeBase64(content)

        const response = await fetch(url, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({
                message: `Update ${filePath}`,
                content: encodedContent,
                sha: item.sha,
                branch: 'main',
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(
                `Failed to update file content: ${response.status} - ${errorText}`
            )
        }

        this.updatedItems.push(filePath)
    }

    // send a pr to the target repo
    async createPullRequest(
        title: string,
        body: string,
        forkedOwner: string,
        forkedRepo: string
    ): Promise<void> {
        const url = `https://api.github.com/repos/${this.owner}/${this.repo}/pulls`
        const headers = this.headers
        const defaultBranch = await this.getDefaultBranch(this.owner, this.repo)

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                title: title,
                head: `${forkedOwner}:main`,
                base: defaultBranch,
                body: body,
                maintainer_can_modify: true,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to create pull request: ${response.status}`)
        }

        const data = await response.json()
        console.log(`Pull request created: ${data.html_url}`)
    }

    // find md files in the repo
    private async get_md_files(): Promise<void> {
        // send an api request to github api and get the repo details
        const url =
            this.url +
            `/git/trees/${this.repo_details.default_branch}?recursive=0`
        const headers = this.headers
        const response = await fetch(url, { headers })
        if (!response.ok) {
            throw new Error(
                `Github API is unable to traverse through the repository : ${response.status}`
            )
        }
        const data = await response.json()
        console.log(`discovering items in ${this.owner + '/' + this.repo}`)
        // identify the md files in the repo
        for (const item of data.tree) {
            if (item.type === 'blob') {
                let type = item.path.split('.').pop()
                if (type == 'md' || type === 'mdx') {
                    this.items.push({ path: item.path, sha: item.sha })
                }
            }
        }
        console.log(`discovered ${this.items.length} items`)
    }

    // get the content of each md file
    private async get_md_file_details(): Promise<void> {
        // send an api request to github api and get the details of each md file
        for (const item of this.items) {
            const url = this.url + `/git/blobs/${item.sha}`
            const headers = this.headers
            const response = await fetch(url, { headers })
            if (!response.ok) {
                throw new Error(
                    `Github API is unable to fetch the content of the md file: ${response.status}`
                )
            }
            const data = await response.json()
            console.log(`discovering details of ${item.path}`)
            const decodedContent = this.decodeBase64(data.content)
            this.md_files_content[item.path] = decodedContent
        }
    }

    private async getDefaultBranchSha(
        owner: string,
        repo: string
    ): Promise<string> {
        const url = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`
        const headers = this.headers
        const response = await fetch(url, {
            ...headers,
            'Content-Type': 'application/json',
        })
        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(
                `Error fetching default branch SHA: ${response.status} ${errorData.message}`
            )
        }

        const data = await response.json()
        return data.object.sha
    }

    private async getDefaultBranch(
        owner: string,
        repo: string
    ): Promise<string> {
        const url = `https://api.github.com/repos/${owner}/${repo}`
        const headers = this.headers

        const response = await fetch(url, { headers })
        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(
                `Error fetching default branch: ${response.status} ${errorData.message}`
            )
        }

        const data = await response.json()
        return data.default_branch
    }

    // reposityory information
    private async get_repo_details(): Promise<any> {
        const headers = this.headers
        const response = await fetch(this.url, { headers })
        if (!response.ok) {
            throw new Error('could not fetch details')
        }
        return await response.json()
    }

    private getHeaders() {
        return {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            'X-GitHub-Api-Version': GITHUB_API_VERSION,
        }
    }

    private encodeBase64(input: string): string {
        const buffer = Buffer.from(input, 'utf-8')
        return buffer.toString('base64')
    }

    private decodeBase64(input: string): string {
        const buffer = Buffer.from(input, 'base64')
        return buffer.toString('utf-8')
    }
}
