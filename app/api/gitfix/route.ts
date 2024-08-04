import { NextResponse } from 'next/server'
import { Github_API } from '@/lib/github-api'
import { addFixedFile, isFileFixed, clearDatabase } from '@/lib/redis-utils'
import { Client, openai, upstash } from '@upstash/qstash'

import OpenAI from 'openai'

export async function GET(request: Request) {
    try {
        console.log('Received request to fix markdown files')
        await clearDatabase()
        const { searchParams } = new URL(request.url)
        const owner = searchParams.get('owner')
        const repo = searchParams.get('repo')
        const auth = searchParams.get('auth')

        if (!owner || !repo || !auth) {
            return NextResponse.json(
                { message: 'Missing required fields' },
                { status: 400 }
            )
        }

        const github = new Github_API(owner, repo, auth)
        await github.initializeRepoDetails()

        const forked_repo_info = await github.forkRepository()
        const forkedOwner = forked_repo_info[0]
        const forkedRepo = forked_repo_info[1]
        await github.getFileContent()

        const encoder = new TextEncoder()

        const customReadable = new ReadableStream({
            async start(controller) {
                let counter = 0
                for (const filePath of Object.keys(github.md_files_content)) {
                    console.log(`Fixing file: ${filePath}`)
                    const originalContent = github.md_files_content[filePath]
                    await publishIntoQStash(
                        originalContent,
                        filePath,
                        forkedOwner,
                        forkedRepo,
                        owner,
                        repo,
                        auth
                    )
                    counter++
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                message: `Processing file: ${filePath}`,
                            })
                        )
                    )
                }

                if (counter === 0) {
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                message: 'No files to fix, either all files are already fixed or there is not any markdown file. Please try again with a different repository.',
                            })
                        )
                    )
                } else {
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                message: 'Job is submitted to the AI model, please wait for response. We will let you know when the job is completed.',
                            })
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
            { message: 'Internal server error', error: (error as any).message },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        const encoder = new TextEncoder()
        const customReadable = new ReadableStream({
            async start(controller) {
                try {
                    const body = await request.json()
                    const decodedBody = JSON.parse(
                        atob(body.body)
                    ) as OpenAI.Chat.Completions.ChatCompletion

                    const corrections = JSON.parse(
                        decodedBody.choices[0].message.content as string
                    ).corrections

                    const filePath = corrections[0].filepath
                    const originalContent = corrections[0].originalContent
                    const forkedOwner = corrections[0].forkedOwner
                    const forkedRepo = corrections[0].forkedRepo
                    const owner = corrections[0].owner
                    const repo = corrections[0].repo
                    const auth = corrections[0].auth

                    if (
                        !filePath ||
                        !originalContent ||
                        !forkedOwner ||
                        !forkedRepo ||
                        !owner ||
                        !repo ||
                        !auth
                    ) {
                        throw new Error('Missing metadata fields')
                    }
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                message: `Corrected content for ${filePath} is being processed, uploading to the repository.`,
                            })
                        )
                    )
                    const correctedContent = await parser(decodedBody, originalContent)

                    const github = new Github_API(owner, repo, auth)
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
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                message: 'Pull request created successfully',
                            })
                        )
                    )
                    controller.close()
                } catch (error) {
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                message: 'Error occurred during the generation of pull request. OpeanAI model might have failed to generate the response, please try again.',
                                error: error,
                            })
                        )
                    )
                    controller.close()
                }
            }
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
        console.error('Error handling POST request:', error)
        return new Response('Internal server error', { status: 500 })
    }
}

async function publishIntoQStash(
    file_content: string,
    filePath: string,
    forkedOwner: string,
    forkedRepo: string,
    owner: string,
    repo: string,
    auth: string
) {
    const qstashToken: string = process.env.QSTASH_TOKEN as string
    const openaiToken: string = process.env.OPENAI_API_KEY as string
    if (!qstashToken || !openaiToken) {
        throw new Error(
            'QSTASH_TOKEN or OPENAI_API_KEY is not set\n' +
                qstashToken +
                '\n' +
                openaiToken
        )
    }

    const client: Client = new Client({
        token: qstashToken,
    })

    const result: any = await client.publishJSON({
        api: {
            name: 'llm',
            provider: openai({ token: openaiToken }),
        },
        body: {
            messages: [
                {
                    role: 'system',
                    content: `
                I want you to fix grammatical errors in an mdx file.
                I will give you the file and you will correct grammatical errors in the text(paragraphs and headers).
                Your response should be an array of json objects.
                Each one of those objects should contain the original line and corrections. 
                Send me all the suggestions in a single answer in the following format:

                Before you start generating corrections, do the following:
                I will give you the required information for the first element, do not change it and directly use it.
                After that, you can start generating corrections.

                Explicity, the form of array will be this: 
                \{corrections : [{
                    "filepath": "${filePath}",
                    "originalContent": "${file_content}",
                    "forkedOwner": "${forkedOwner}",
                    "forkedRepo": "${forkedRepo}",
                    "owner": "${owner}",
                    "repo": "${repo}",
                    "auth": "${auth}"
                }
                {original_line, correction}, 
                {original_line, correction}]\}

                You should only correct what is given in the file, do not add any original text.
                DO NOT perform any action if you detect code blocks, paths or links.
                DO NOT alter any of the code blocks, codes, paths or links.
                DO NOT change the indentation of the code blocks.
                In the front matter section, change only the title and summary if they are given in the original file.
                DO NOT change any of the code blocks, including the strings and comments inside the code block.
                Change the errors line by line and do not merge lines. Do not copy the content of one line to the other.
                DO NOT merge lines.
                DO NOT change the words with their synonyms.
                DO NOT erase the front matter section. 
                `,
                },
                { role: 'user', content: file_content },
            ],
            response_format: { type: 'json_object' },
            model: 'gpt-4-turbo-preview',
            temperature: 0,
        },
        callback: process.env.NEXTAUTH_URL + '/api/gitfix',
    })
    return NextResponse.json({
        message: 'API response is generated',
        qstashMessageId: result.messageId,
    })
}

async function parser(
    completion: OpenAI.Chat.Completions.ChatCompletion,
    file_content: string
) {
    const response = completion.choices[0]?.message?.content

    let suggestions
    try {
        suggestions = JSON.parse(response as string).corrections.slice(1)
    } catch (parseError: any) {
        throw new Error(`Failed to parse JSON response: ${parseError.message}`)
    }

    for (let i = 0; i < suggestions.length; i++) {
        const { original_line, correction } = suggestions[i]
        const contentIndex = file_content.indexOf(original_line)
        if (contentIndex === -1) {
            console.log('Original line missing:', original_line)
            continue
        }
        const contentIndexEnd = contentIndex + original_line.length
        file_content =
            file_content.substring(0, contentIndex) +
            correction +
            file_content.substring(contentIndexEnd)
    }
    return file_content
}
