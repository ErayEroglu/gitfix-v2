const GITHUB_API_VERSION = '2022-11-28'
const RETRY_LIMIT = 50
const RETRY_DELAY_MS = 10000
const GITFIX_BRANCH = 'gitfix'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
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

    async get_file_content(): Promise<void> {
        await this.get_md_files()
        await this.get_md_file_details()
    }

    async create_branch(new_branch: string): Promise<void> {
        const url = `https://api.github.com/repos/${this.owner}/${this.repo}/git/refs`
        const headers = {
            'Authorization' : 'Bearer ' + GITHUB_TOKEN,
            'Accept' : 'application/vnd.github+json', 
            'Content-Type' : 'application/json' ,
        }

        const sha = await this.getDefaultBranchSha();
       
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

    async create_pull_request(title: string, body: string): Promise<void> {
        const url = `${this.url}/pulls`
        const headers = this.headers

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: title,
                head: GITFIX_BRANCH,
                base: this.repo_details.default_branch,
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

    async update_file_content(
        file_path: string,
        content: string,
        branch_name: string
    ): Promise<void> {
        const item = this.items.find((item) => item.path === file_path)
        if (!item) {
            throw new Error(`File ${file_path} not found in the repository.`)
        }
        const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${file_path}`
        const headers = {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            'X-GitHub-Api-Version': GITHUB_API_VERSION,
            'Content-Type' : 'application/json',
        }
        const sha = item.sha
        const encodedContent = this.encodeBase64(content)

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({
                    message: `Update ${file_path}`,
                    content: encodedContent,
                    sha: sha,
                    branch: branch_name,
                }),
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(
                    `Failed to update file content: ${response.status} - ${errorText}`
                )
            }

            this.updatedItems.push(file_path)
        } catch (error) {
            console.error(
                `Error occurred while updating file content: ${(error as Error).message}`
            )
            throw error
        }
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
        console.log(data)
        console.log(`discovering items in ${this.owner + '/' + this.repo}`)
        // identify the md files in the repo
        console.log(data.tree)
        for (const item of data.tree) {
            if (item.type === 'blob') {
                let type = item.path.split('.').pop()
                if (type == 'md' || type === 'mdx') {
                    console.log(item.path)
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

    private async getDefaultBranchSha(): Promise<string> {
        const url = `https://api.github.com/repos/${this.owner}/${this.repo}/git/refs/heads/main`; 
        const headers = {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
        };
    
        const response = await fetch(url, { headers });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Error fetching default branch SHA: ${response.status} ${errorData.message}`);
        }
    
        const data = await response.json();
        return data.object.sha;
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
            Authorization: `Bearer ${this.auth}`,
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
