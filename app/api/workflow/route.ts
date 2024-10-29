import { serve } from '@upstash/qstash/nextjs'
import { Client } from '@upstash/qstash'
import OpenAI from 'openai'
import { Github_API } from '@/lib/github-api'
import { RedisManager } from '@/lib/redis-utils'

type OpenAiResponse = {
    choices: {
        message: {
            role: string
            content: string | OpenAI.Chat.Completions.ChatCompletion
        }
    }[]
}

export function GET() {
    return new Response('Hello from the workflow endpoint!')
}

export const POST = serve<{
    owner: string
    repo: string
    type: Number
    filePath: string | undefined
    branch: string | undefined
}>(
    async (context) => {
        const {
            github,
            owner,
            repo,
            branch,
            forkedOwner,
            forkedRepo,
            taskID,
            prompt,
            openaiToken,
        } = await context.run('Worklflow initilization', async () => {
            return (await initializeWorkflow(context)) as any
        })

        if (!github) {
            return
        }

        let counter = 0
        let numberOfFiles = Object.keys(github.md_files_content).length

        for (const filePath of Object.keys(github.md_files_content)) {
            counter++
            const originalContent = github.md_files_content[filePath]
            const isLastFile = counter === numberOfFiles
            console.log('sending the task to the workflow')
            const response = await context.call<OpenAiResponse>(
                'markdown grammar correction',
                'https://api.openai.com/v1/chat/completions',
                'POST',
                {
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a grammar correction assistant.',
                        },
                        { role: 'user', content: prompt },
                        { role: 'user', content: originalContent },
                    ],
                },
                { authorization: `Bearer ${openaiToken}` }
            )

            const corrections = response.choices[0].message.content
            await context.run('PR creation', async () => {
                await processCorrections(
                    owner,
                    repo,
                    branch,
                    filePath,
                    corrections as string,
                    forkedOwner,
                    forkedRepo,
                    taskID,
                    isLastFile
                )
            })
        }
    },
    {
        retries: 0,
        baseUrl:
            process.env.NODE_ENV === 'development'
                ? `${process.env.UPSTASH_WORKFLOW_URL}`
                : undefined,
    }
)

async function initializeWorkflow(context: any) {
    const client = new Client({ token: process.env.QSTASH_TOKEN as string })
    const url = process.env.UPSTASH_WORKFLOW_URL + '/api/status'

    const redis = new RedisManager()
    redis.clearDatabase()
    const request = context.requestPayload
    const owner = request.owner
    const repo = request.repo
    const type = request.type
    const filePath = request.filePath
    const branch = request.branch
    const taskID = request.taskID
    const inputType = Number(type)

    const qstashToken = process.env.QSTASH_TOKEN
    const openaiToken = process.env.OPENAI_API_KEY

    if (!qstashToken || !openaiToken) {
        throw new Error('Missing QSTASH_TOKEN or OPENAI_API_KEY')
    }

    await client.publish({
        url: url,
        body: JSON.stringify({
            log: ' Workflow started, repository details are being fetched',
            taskID: taskID,
            status: 'success',
        }),
    })  

    const github = new Github_API(owner, repo, inputType)

    try {
        if (!inputType) {
            await github.initializeRepoDetails(filePath, branch)
        } else {
            await github.initializeRepoDetails()
        }
    } catch (error) {
        await client.publish({
            url: url,
            body: JSON.stringify({
                log: `Error fetching repository details for ${owner}/${repo}: ${
                    (error as any).message
                }`,
                taskID: taskID,
                status: 'error',
            }),
        })
        return
    }

    const forked_repo_info = await github.forkRepository()

    await client.publish({
        url: url,
        body: JSON.stringify({
            log: 'Repository details are initialized, and the repository is forked',
            taskID: taskID,
            status: 'success',
        }),
    })

    const forkedOwner = forked_repo_info[0]
    const forkedRepo = forked_repo_info[1]

    try {
        await github.getFileContent()
    } catch (error) {
        await client.publish({
            url: url,
            body: JSON.stringify({
                log: `Error fetching file details for ${filePath}: ${
                    (error as any).message
                }`,
                taskID: taskID,
                status: 'error',
            }),
        })
        return
    }

    const prompt = `
        I want you to fix grammatical errors in a markdown file.
        I will give you the file and you will correct grammatical errors in the text (paragraphs and headers).
        You should only correct what is given in the file, do not add anything to the original text.
        DO NOT change any of the code blocks, including the strings, comments and indentations inside the code block. Keep them as they are, even though they have issues.
        DO NOT change any of the paths or links, also do not edit any part of code blocks.
        DO NOT change quotation marks, brackets, parentheses, or any other special characters, including the ones in the code blocks.
        Do not try to edit any kind of quotation marks, single or double.
        DO NOT change or try to modify emojis.
        In the front matter section, change only the title and summary if they are given in the original file.
        Change the errors line by line and do not merge lines. Do not copy the content of one line to the other.
        DO NOT merge lines.
        DO NOT change the words with their synonyms.
        DO NOT erase the front matter section. 
        `
    await client.publish({
        url: url,
        body: JSON.stringify({
            log: `Text content for ${filePath} is sent to the OpenAI API, waiting for the grammatical errors to be fixed`,
            taskID: taskID,
            status: 'success',
        }),
    })

    return {
        github,
        owner,
        repo,
        branch,
        forkedOwner,
        forkedRepo,
        taskID,
        prompt,
        openaiToken,
    }
}

async function processCorrections(
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
    corrections: string,
    forkedOwner: string,
    forkedRepo: string,
    taskID: string,
    isLastFile: boolean
) {
    const url = process.env.UPSTASH_WORKFLOW_URL + '/api/status'
    const client = new Client({ token: process.env.QSTASH_TOKEN as string })

    if (!corrections) {
        await client.publish({
            url: url,
            body: JSON.stringify({
                log: 'Grammar correction is not returned from the OpenAI API, please check the environment variables',
                taskID: taskID,
                status: 'error',
            }),
        })
        return
    }

    const github = new Github_API(owner, repo, 0, filePath)
    await github.initializeRepoDetails(filePath, branch)

    await client.publish({
        url: url,
        body: JSON.stringify({
            log: 'Grammatical errors are fixed in the markdown file, committing the changes',
            taskID: taskID,
            status: 'success',
        }),
    })

    try {
        await commitCorrections(
            github,
            filePath,
            corrections,
            forkedOwner,
            forkedRepo
        )
    } catch (error) {
        await client.publish({
            url: url,
            body: JSON.stringify({
                log: `Error committing the changes: ${(error as any).message}`,
                taskID: taskID,
                status: 'error',
            }),
        })
        return
    }

    await client.publish({
        url: url,
        body: JSON.stringify({
            log: 'Changes are committed, creating a pull request',
            taskID: taskID,
            status: 'success',
        }),
    })

    const prTitle = 'Fix grammatical errors in markdown files by Gitfix'
    const prBody =
        'This pull request fixes grammatical errors in the markdown files. ' +
        'Changes are made by Gitfix, which is an AI-powered application, ' +
        'aims to help developers in their daily tasks.'
    console.log('Creating a pull request')
    try {
        await github.createPullRequest(prTitle, prBody, forkedOwner, forkedRepo)
    } catch (error) {
        await client.publish({
            url: url,
            body: JSON.stringify({
                log: `Error creating the pull request: ${
                    (error as any).message
                }`,
                taskID: taskID,
                status: 'error',
            }),
        })
        return
    }
    await client.publish({
        url: url,
        body: JSON.stringify({
            log: 'Pull request is created, the task is completed. You can check the pull request on the repository',
            taskID: taskID,
            status: 'success',
        }),
    })
}

async function commitCorrections(
    github: Github_API,
    filePath: string,
    corrections: string,
    forkedOwner: string,
    forkedRepo: string
) {
    try {
        await github.updateFileContent(
            filePath,
            corrections,
            forkedOwner,
            forkedRepo,
            true
        )
    } catch (error) {
        await github.updateFileContent(
            filePath,
            corrections,
            forkedOwner,
            forkedRepo,
            true,
            'master'
        )
    }
}
