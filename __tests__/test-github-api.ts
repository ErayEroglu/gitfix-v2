import nock from 'nock'
import { Github_API } from '../app/lib/github-api'
import { getSessionId } from '../app/lib/github-session'
import dotenv from 'dotenv'
dotenv.config()

const GITHUB_API_VERSION = '2022-11-28'
const GITFIX_BRANCH = 'gitfix'

const owner = 'test-owner'
const repo = 'test-repo'
let api: Github_API

describe('Github_API', () => {
    beforeAll(async () => {
        const session_id = getSessionId()
        api = new Github_API(owner, repo)
        await api.initializeRepoDetails(session_id)
    })

    beforeEach(() => {
        nock.cleanAll()
    })

    test('should find markdown files', async () => {
        nock('https://api.github.com')
            .get(
                `/repos/${owner}/${repo}/git/trees/${api.repo_details.default_branch}?recursive=0`
            )
            .reply(200, {
                tree: [
                    { type: 'blob', path: 'file1.md', sha: 'sha1' },
                    { type: 'blob', path: 'file2.txt', sha: 'sha2' },
                ],
            })

        await api.get_md_files()
        expect(api.items).toEqual([{ path: 'file1.md', sha: 'sha1' }])
    })

    test('should handle errors when fetching markdown files', async () => {
        nock('https://api.github.com')
            .get(
                `/repos/${owner}/${repo}/git/trees/${api.repo_details.default_branch}?recursive=0`
            )
            .reply(500)

        await expect(api.get_md_files()).rejects.toThrow(
            'Github API is unable to traverse through the repository : 500'
        )
    })

    test('should create a new branch', async () => {
        nock('https://api.github.com')
            .get(`/repos/${owner}/${repo}/git/refs/heads/main`)
            .reply(200, { object: { sha: 'sha1' } })

        nock('https://api.github.com')
            .post(`/repos/${owner}/${repo}/git/refs`)
            .reply(201)

        await api.create_branch('new-branch')
    })

    test('should create a pull request', async () => {
        nock('https://api.github.com')
            .post(`/repos/${owner}/${repo}/pulls`)
            .reply(201, {
                html_url: 'https://github.com/test-owner/test-repo/pull/1',
            })

        await api.create_pull_request('PR Title', 'PR Body')
    })

    test('should update file content', async () => {
        api.items = [{ path: 'file1.md', sha: 'sha1' }]

        nock('https://api.github.com')
            .put(`/repos/${owner}/${repo}/contents/file1.md`)
            .reply(200)

        await api.update_file_content(0, 'Updated content')
        expect(api.updatedItems).toContain(0)
    })
})
