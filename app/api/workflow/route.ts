import { serve } from '@upstash/qstash/nextjs'
import OpenAI from 'openai'
import { Github_API } from '@/lib/github-api'
import {
    addFixedFile,
    isFileFixed,
    clearDatabase,
    storeItem,
    getItem,
} from '@/lib/redis-utils'

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

        const { github, forkedOwner, forkedRepo, taskID, prompt, openaiToken } = await context.run('Worklflow initilization', async () => {
            return await initializeWorkflow(context)
        })

        console.log('forkedOwner : ', forkedOwner , 'repo : ', forkedRepo, 'taskID : ', taskID, 'prompt : ', prompt, 'openaiToken : ', openaiToken)

        // await clearDatabase()
        // const request = context.requestPayload
        // const owner = request.owner
        // const repo = request.repo
        // const type = request.type
        // const filePath = request.filePath
        // const branch = request.branch
        // const inputType = Number(type)

        // const qstashToken = process.env.QSTASH_TOKEN
        // const openaiToken = process.env.OPENAI_API_KEY

        // if (!qstashToken || !openaiToken) {
        //     throw new Error('Missing QSTASH_TOKEN or OPENAI_API_KEY')
        // }

        // const time = new Date().getTime()
        // const taskID = `${owner}@${repo}@${time}`
        // const github = new Github_API(owner, repo, inputType)

        // if (!inputType) {
        //     await github.initializeRepoDetails(filePath, branch)
        // } else {
        //     await github.initializeRepoDetails()
        // }

        // const forked_repo_info = await github.forkRepository()
        // const forkedOwner = forked_repo_info[0]
        // const forkedRepo = forked_repo_info[1]
        // await github.getFileContent()
        // const prompt = `
        //         I want you to fix grammatical errors in a markdown file.
        //         I will give you the file and you will correct grammatical errors in the text (paragraphs and headers).
        //         You should only correct what is given in the file, do not add anything to the original text.
        //         Code blocks are untouchable ,DO NOT perform any action if you detect code blocks, paths or links.
        //         DO NOT change any of the code blocks, including the strings, comments and indentations inside the code block.
        //         DO NOT alter any part of the code blocks, codes, paths or links.
        //         DO NOT change quotation marks, brackets, parentheses, or any other special characters, including the ones in the code blocks.
        //         In the front matter section, change only the title and summary if they are given in the original file.
        //         Change the errors line by line and do not merge lines. Do not copy the content of one line to the other.
        //         DO NOT merge lines.
        //         DO NOT change the words with their synonyms.
        //         DO NOT change or try to modify emojis.
        //         DO NOT erase the front matter section. 
        //         `

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
                    model: 'gpt-4-turbo',
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

            console.log('response  is taken from workflow')
            const corrections = response.choices[0].message.content
            console.log('corrections are here:', corrections)
            console.log('Sending PR part')

            await context.run('PR creation', async () => {
                try {
                    await github.updateFileContent(
                        filePath,
                        corrections as string,
                        forkedOwner,
                        forkedRepo,
                        true
                    )
                } catch (error) {
                    await github.updateFileContent(
                        filePath,
                        corrections as string,
                        forkedOwner,
                        forkedRepo,
                        true,
                        'master'
                    )
                }
                await addFixedFile(`${forkedOwner}@${forkedRepo}@${filePath}`)
                const prTitle =
                    'Fix grammatical errors in markdown files by Gitfix'
                const prBody =
                    'This pull request fixes grammatical errors in the markdown files. ' +
                    'Changes are made by Gitfix, which is an AI-powered application, ' +
                    'aims to help developers in their daily tasks.'
                console.log('Creating a pull request')
                await github.createPullRequest(
                    prTitle,
                    prBody,
                    forkedOwner,
                    forkedRepo
                )
                if (isLastFile) {
                    await storeItem(`${taskID}`, 'completed')
                }
            })

            // try {
            //     await github.updateFileContent(
            //         filePath,
            //         corrections as string,
            //         forkedOwner,
            //         forkedRepo,
            //         true
            //     )
            // } catch (error) {
            //     await github.updateFileContent(
            //         filePath,
            //         corrections as string,
            //         forkedOwner,
            //         forkedRepo,
            //         true,
            //         'master'
            //     )
            // }
            // await addFixedFile(`${forkedOwner}@${forkedRepo}@${filePath}`)
            // const prTitle =
            //     'Fix grammatical errors in markdown files by Gitfix'
            // const prBody =
            //     'This pull request fixes grammatical errors in the markdown files. ' +
            //     'Changes are made by Gitfix, which is an AI-powered application, ' +
            //     'aims to help developers in their daily tasks.'
            // console.log('Creating a pull request')
            // await github.createPullRequest(
            //     prTitle,
            //     prBody,
            //     forkedOwner,
            //     forkedRepo
            // )
            // if (isLastFile) {
            //     await storeItem(`${taskID}`, 'completed')
            // }
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
    await clearDatabase()
    const request = context.requestPayload
    const owner = request.owner
    const repo = request.repo
    const type = request.type
    const filePath = request.filePath
    const branch = request.branch
    const inputType = Number(type)

    const qstashToken = process.env.QSTASH_TOKEN
    const openaiToken = process.env.OPENAI_API_KEY

    if (!qstashToken || !openaiToken) {
    throw new Error('Missing QSTASH_TOKEN or OPENAI_API_KEY')
    }

    const time = new Date().getTime()
    const taskID = `${owner}@${repo}@${time}`
    const github = new Github_API(owner, repo, inputType)

    if (!inputType) {
    await github.initializeRepoDetails(filePath, branch)
    } else {
    await github.initializeRepoDetails()
    }

    const forked_repo_info = await github.forkRepository()
    const forkedOwner = forked_repo_info[0]
    const forkedRepo = forked_repo_info[1]
    await github.getFileContent()
    const prompt = `
        I want you to fix grammatical errors in a markdown file.
        I will give you the file and you will correct grammatical errors in the text (paragraphs and headers).
        You should only correct what is given in the file, do not add anything to the original text.
        Code blocks are untouchable ,DO NOT perform any action if you detect code blocks, paths or links.
        DO NOT change any of the code blocks, including the strings, comments and indentations inside the code block.
        DO NOT alter any part of the code blocks, codes, paths or links.
        DO NOT change quotation marks, brackets, parentheses, or any other special characters, including the ones in the code blocks.
        In the front matter section, change only the title and summary if they are given in the original file.
        Change the errors line by line and do not merge lines. Do not copy the content of one line to the other.
        DO NOT merge lines.
        DO NOT change the words with their synonyms.
        DO NOT change or try to modify emojis.
        DO NOT erase the front matter section. 
        `

    return { github, forkedOwner, forkedRepo, taskID, prompt, openaiToken }
}