import { serve } from '@upstash/qstash/nextjs'
import OpenAI from 'openai'

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
    originalContent: string
    filePath: string
    forkedOwner: string
    forkedRepo: string
    owner: string
    repo: string
    isLastFile: boolean
    type: string
}>(
    async (context) => {
        console.log('inside the post function at workflow endpoint')
        const request = context.requestPayload
        const {
            originalContent,
            filePath,
            forkedOwner,
            forkedRepo,
            owner,
            repo,
            isLastFile,
            type,
        } = request

        const qstashToken = process.env.QSTASH_TOKEN
        const openaiToken = process.env.OPENAI_API_KEY

        if (!qstashToken || !openaiToken) {
            throw new Error('Missing QSTASH_TOKEN or OPENAI_API_KEY')
        }

        const prompt = `
        I want you to fix grammatical errors in a markdown file.
        Here is the file:
        Filepath: ${filePath}
        Owner: ${owner}
        Repository: ${repo}
        Forked Owner: ${forkedOwner}
        Forked Repository: ${forkedRepo}
        Is Last File: ${isLastFile}
        Type: ${type}

        Correct the grammatical errors in the file line by line. 
        Do not modify code blocks, paths, or links.
    `
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
        const corrections = response.choices[0].message.content
        const gitfixResponse = await fetch(
            process.env.NEXTAUTH_URL + '/api/gitfix',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${qstashToken}`,
                },
                body: JSON.stringify({
                    originalContent,
                    filePath,
                    forkedOwner,
                    forkedRepo,
                    owner,
                    repo,
                    isLastFile,
                    type,
                    corrections
                }),
            }
        )

        if (!gitfixResponse.ok) {
            throw new Error('Failed to send corrections to GitFix endpoint')
        }

        console.log('GitFix response is sent successfully')
    },
    {
        // Conditionally set in development, but not in production
        baseUrl:
            process.env.NODE_ENV === 'development'
                ? `${process.env.UPSTASH_WORKFLOW_URL}`
                : undefined,
    }
)
