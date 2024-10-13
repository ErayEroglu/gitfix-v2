import { NextResponse } from 'next/server'
import { Github_API } from '@/lib/github-api'
import { addFixedFile, isFileFixed, clearDatabase } from '@/lib/redis-utils'
import { Chat, Client, openai, upstash } from '@upstash/qstash'
import OpenAI from 'openai'
import { serve } from '@upstash/qstash/nextjs'
import { Console } from 'console'

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
        console.log('owner:', owner, 'repo:', repo, 'type:', type)

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

        console.log('trying to fork the repo')
        const forked_repo_info = await github.forkRepository()
        console.log('repo is forked')
        const forkedOwner = forked_repo_info[0]
        const forkedRepo = forked_repo_info[1]
        await github.getFileContent()

        console.log('file content is extracted')
        const encoder = new TextEncoder()
        const customReadable = new ReadableStream({
            async start(controller) {
                let counter = 0
                let numberOfFiles = Object.keys(github.md_files_content).length
                for (const filePath of Object.keys(github.md_files_content)) {
                    counter++
                    const originalContent = github.md_files_content[filePath]
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
                    // logs the selected file
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                message: `Selected file : ${filePath}`,
                            }) + '#' // Adding a delimiter for better handling in frontend
                        )
                    )
                }

                if (counter === 0) {
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                message:
                                    'No files to fix, either all files are already fixed or there is not any markdown file. Please try again with a different repository.',
                            }) + '#'
                        )
                    )
                } else {
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                message:
                                    'Job is submitted to the AI model, please wait for the response. We will let you know when the job is completed.',
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