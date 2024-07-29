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
        this.repo_details = await this.getRepoDetails()
    }

    // find the md files and extract the text
    async getFileContent(): Promise<void> {
        await this.getMdFiles()
        await this.getMdFileDetails()
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
        forkedRepo: string,
        flag: boolean
    ): Promise<void> {
        const url = `https://api.github.com/repos/${forkedOwner}/${forkedRepo}/contents/${filePath}`
        const headers = this.headers
        const encodedContent = this.encodeBase64(content)
        const branch = await this.setBranch(forkedOwner, flag)
        const sha = await this.getFileSHA(url, headers, branch)
        const body = JSON.stringify({
            message: `Update ${filePath}`,
            content: encodedContent,
            sha: sha,
            branch: branch,
        })

        const response = await fetch(url, {
            method: 'PUT',
            headers: headers,
            body: body,
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
        const head = await this.setBranch(forkedOwner, false)
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                title: title,
                head: `${forkedOwner}:${head}`,
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

    private async createBranch(new_branch: string): Promise<void> {
        const url = `https://api.github.com/repos/${this.owner}/${this.repo}/git/refs`
        const headers = {
            Authorization: 'Bearer ' + GITHUB_TOKEN,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
        }

        const sha = await this.getDefaultBranchSha(this.owner, this.repo)

        const create_ref_body = {
            ref: `refs/heads/${new_branch}`,
            sha: sha,
        }
        const create_ref_response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(create_ref_body),
        })

        if (!create_ref_response.ok) {
            throw new Error(
                `Could not create branch: ${create_ref_response.status}`
            )
        }
    }

    // sets the branch to push the changes
    // if the forked repo is the same as the target repo, it creates a new branch
    private async setBranch(
        forkedOwner: string,
        flag: boolean
    ): Promise<string> {
        if (forkedOwner === this.owner) {
            if (flag) {
                try {
                    await this.createBranch('gitfix')
                } catch (error) {
                    console.log('Branch already exists')
                }
            }
            return 'gitfix'
        } else {
            return 'main'
        }
    }

    // finds md files in the repo
    private async getMdFiles(): Promise<void> {
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
        console.log(
            `Searching for markdown files in ${this.owner + '/' + this.repo}`
        )
        // identify the md files in the repo
        for (const item of data.tree) {
            if (item.type === 'blob') {
                let type = item.path.split('.').pop()
                if (type == 'md' || type === 'mdx') {
                    this.items.push({ path: item.path, sha: item.sha })
                }
            }
        }
        console.log(`Discovered ${this.items.length} items`)
    }

    // get sthe content of each md file
    private async getMdFileDetails(): Promise<void> {
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
            console.log(`Extracting the contents of ${item.path}`)
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
            if (response.status === 404) {
                const newUrl = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/master`
                const newResponse = await fetch(newUrl, {
                    ...headers,
                    'Content-Type': 'application/json',
                })

                if (newResponse.ok) {
                    const data = await newResponse.json()
                    return data.object.sha
                }
            }
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
    private async getRepoDetails(): Promise<any> {
        const headers = this.headers
        const response = await fetch(this.url, { headers })
        if (!response.ok) {
            throw new Error('could not fetch details')
        }
        return await response.json()
    }

    private async getFileSHA(
        url: string,
        headers: any,
        branch: string
    ): Promise<string> {
        const response = await fetch(`${url}?ref=${branch}`, {
            method: 'GET',
            headers: headers,
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(
                `Failed to get file SHA: ${response.status} - ${errorText}`
            )
        }

        const fileData = await response.json()
        return fileData.sha
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
