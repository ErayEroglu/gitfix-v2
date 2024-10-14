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

const baseUrl = process.env.NEXTAUTH_URL

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
        I will give you the file and you will correct grammatical errors in the text (paragraphs and headers).
        You should only correct what is given in the file, do not add anything to the original text.
        Code blocks are untouchable ,DO NOT perform any action if you detect code blocks, paths or links.
        DO NOT change any of the code blocks, including the strings, comments and indentations inside the code block.
        DO NOT alter any part of the code blocks, codes, paths or links.
        In the front matter section, change only the title and summary if they are given in the original file.
        Change the errors line by line and do not merge lines. Do not copy the content of one line to the other.
        DO NOT merge lines.
        DO NOT change the words with their synonyms.
        DO NOT change or try to modify emojis.
        DO NOT erase the front matter section. 
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
                    corrections,
                }),
            }
        )

        if (!gitfixResponse.ok) {
            throw new Error('Failed to send corrections to GitFix endpoint')
        }
    },
    {
        // Conditionally set in development, but not in production
        baseUrl:
            process.env.NODE_ENV === 'development'
                ? `${process.env.UPSTASH_WORKFLOW_URL}`
                : undefined,
    }
)
