import { NextResponse } from 'next/server'
import { Github_API } from '@/lib/github-api'
import { generate_grammatically_correct_content } from '@/lib/grammar-correction'

export async function POST(request: Request) {
    try {
        console.log('Received request to fix markdown files')

        // Parse the JSON request body
        const { owner, repo, auth, branch_name, pr_title, pr_body } =
            await request.json()

        if (!owner || !repo || !auth || !branch_name || !pr_title || !pr_body) {
            return NextResponse.json(
                { message: 'Missing required fields' },
                { status: 400 }
            )
        }

        // Initialize GitHub API
        const github = new Github_API(owner, repo, auth)
        await github.initializeRepoDetails()
        await github.create_branch(branch_name)
        // Fetch and update Markdown files content
        await github.get_file_content()
        for (const file_path of Object.keys(github.md_files_content)) {
            const original_content = github.md_files_content[file_path]
            const corrected_content =
                await generate_grammatically_correct_content(original_content)
            await github.update_file_content(
                file_path,
                corrected_content,
                branch_name
            )
        }

        // Create a pull request
        await github.create_pull_request(pr_title, pr_body)
        console.log('here')
        return NextResponse.json(
            { message: 'Pull request created successfully' },
            { status: 200 }
        )
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: 'Internal server error', error: (error as any).message },
            { status: 500 }
        )
    }
}
