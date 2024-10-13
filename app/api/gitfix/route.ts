import { NextResponse } from 'next/server'
import { Github_API } from '@/lib/github-api'
import { addFixedFile, isFileFixed, clearDatabase } from '@/lib/redis-utils'

const baseUrl = process.env.NEXTAUTH_URL

// handles the GET request from the client, the  search page
// it will fork the repository and get the file content, then publish the task to QStash
export async function GET(request: Request) {
    try {
        //TODO: this part will be deleted
        await clearDatabase()
        const { searchParams } = new URL(request.url)
        const owner = searchParams.get('owner')
        const repo = searchParams.get('repo')
        const typeParam = searchParams.get('type')
        const type = typeParam !== null ? Number(typeParam) : NaN

        if (!owner || !repo) {
            return NextResponse.json(
                { message: 'The URL is invalid, please check it' },
                { status: 400 }
            )
        }
        const github = new Github_API(owner, repo, type)

        if (!type) {
            const filePath = searchParams.get('filePath')
            await github.initializeRepoDetails(filePath)
        } else {
            await github.initializeRepoDetails()
        }

        const forked_repo_info = await github.forkRepository()
        const forkedOwner = forked_repo_info[0]
        const forkedRepo = forked_repo_info[1]
        await github.getFileContent()
        const encoder = new TextEncoder()
        const customReadable = new ReadableStream({
            async start(controller) {
                let counter = 0
                let numberOfFiles = Object.keys(github.md_files_content).length

                controller.enqueue(
                    encoder.encode(
                        JSON.stringify({
                            message: 'Starting repository forking process.',
                        }) + '#'
                    )
                )

                for (const filePath of Object.keys(github.md_files_content)) {
                    counter++
                    const originalContent = github.md_files_content[filePath]

                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                message: `Forking repository: ${owner}/${repo}`,
                            }) + '#'
                        )
                    )

                    // Fork the repository
                    const forked_repo_info = await github.forkRepository()
                    const forkedOwner = forked_repo_info[0]
                    const forkedRepo = forked_repo_info[1]

                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                message: `Fetching file content from ${filePath}`,
                            }) + '#'
                        )
                    )

                    controller.enqueue (
                        encoder.encode(
                            JSON.stringify({
                                message: `Sending the file content to Upstash Workflow, where the AI service will correct the grammatical errors.`,
                            }) + '#'
                        )
                    )

                    // Send to QStash Workflow or AI service
                    const workflowUrl = `${baseUrl}/api/workflow`
                    await fetch(workflowUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            originalContent,
                            filePath,
                            forkedOwner,
                            forkedRepo,
                            owner,
                            repo,
                            isLastFile: counter === numberOfFiles,
                            type,
                        }),
                    })

                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                message: `Waiting for the AI service to correct the grammatical errors in the file, this may take a while.`,
                            }) + '#'
                        )
                    )

                }

                controller.close()
            },
        })

        const headers = {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
            'Access-Control-Allow-Headers':
                'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
        }

        return new Response(customReadable, { headers })
    } catch (error) {
        console.error('Error handling GET request:', error)
        return NextResponse.json(
            {
                message:
                    'The repository details could not be fetched, please check the entered information.',
                error: (error as any).message,
            },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const {
            originalContent,
            filePath,
            forkedOwner,
            forkedRepo,
            owner,
            repo,
            isLastFile,
            type,
            corrections,
        } = body

        const correctedContent = corrections
        if (
            !filePath ||
            !originalContent ||
            !forkedOwner ||
            !forkedRepo ||
            !owner ||
            !repo
        ) {
            throw new Error('Missing metadata fields')
        }
        const github = new Github_API(owner, repo, type)
        await github.initializeRepoDetails()
        await github.updateFileContent(
            filePath,
            correctedContent,
            forkedOwner,
            forkedRepo,
            true
        )
        await addFixedFile(`${forkedOwner}@${forkedRepo}@${filePath}`)
        const prTitle = 'Fix grammatical errors in markdown files by Gitfix'
        const prBody =
            'This pull request fixes grammatical errors in the markdown files. ' +
            'Changes are made by Gitfix, which is an AI-powered application, ' +
            'aims to help developers in their daily tasks.'
        await github.createPullRequest(prTitle, prBody, forkedOwner, forkedRepo)

        if (isLastFile) {
            const statusUrl = `${baseUrl}/api/status`
            const statusResponse = await fetch(statusUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    logs: ['Pull request created successfully.'],
                    id: `${owner}@${repo}`,
                }),
            })
            if (!statusResponse.ok) {
                console.error(
                    'Failed to update status:',
                    await statusResponse.text()
                )
            }
        }
        return new Response('OK', { status: 200 })
    } catch (error) {
        console.error(
            'Error while uploading grammatically corrected content:',
            error
        )
        return new Response('Internal server error', { status: 500 })
    }
}
