import { NextResponse } from 'next/server'
import { Github_API } from '@/lib/github-api'
import { generate_grammatically_correct_content } from '@/lib/grammar-correction'
import { addFixedFile, isFileFixed } from '@/lib/redis-utils'

export async function POST(request: Request) {
    try {
        console.log('Received request to fix markdown files')

        // Parse the JSON request body
        const { owner, repo, auth } = await request.json()

        if (!owner || !repo || !auth) {
            return NextResponse.json(
                { message: 'Missing required fields' },
                { status: 400 }
            )
        }

        // Initialize GitHub API
        const github = new Github_API(owner, repo, auth)
        await github.initializeRepoDetails()
        const forked_repo_info = await github.forkRepository()
        const forkedOwner = forked_repo_info[0]
        const forkedRepo = forked_repo_info[1]
        let flag: boolean = true
        // Fetch and update Markdown files content
        await github.get_file_content()
        let counter = 0
        for (const file_path of Object.keys(github.md_files_content)) {
            const is_fixed = await isFileFixed(
                forkedOwner + '@' + forkedRepo + '@' + file_path
            )
            if (is_fixed) {
                console.log(`File ${file_path} is already fixed, skipping...`)
                continue
            }
            console.log(`Fixing file: ${file_path}`)
            if (counter > 3) {
                console.log(
                    'Max file limit reached, if you want to process more files, ' +
                        'please run the app again.'
                )
                break
            }
            const original_content = github.md_files_content[file_path]
            const corrected_content =
                await generate_grammatically_correct_content(original_content)
            await github.updateFileContent(
                file_path,
                corrected_content,
                forkedOwner,
                forkedRepo,
                flag
            )
            flag = false
            counter++
            await addFixedFile(forkedOwner + '@' + forkedRepo + '@' + file_path)
        }
        if (counter === 0) {
            console.log('No files to fix')
            return NextResponse.json(
                {
                    message:
                        'There is not any markdown file, or all of them are already fixed',
                },
                { status: 200 }
            )
        }

        // Create a pull request
        const pr_title = 'Fix grammatical errors in markdown files by Gitfix'
        const pr_body =
            'This pull request fixes grammatical errors in the markdown files. ' +
            'Changes are made by Gitfix, which is an AI-powered application, ' +
            'aims to help developers in their daily tasks.'
        await github.createPullRequest(
            pr_title,
            pr_body,
            forkedOwner,
            forkedRepo
        )
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
