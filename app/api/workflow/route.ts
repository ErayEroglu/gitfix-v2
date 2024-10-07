import { serve } from '@upstash/qstash/nextjs'
import { Client, openai } from '@upstash/qstash'
import { NextResponse } from 'next/server'
import OpenAI from 'openai/index.mjs'
import { parser } from '../gitfix/route'

type OpenAiResponse = {
    choices: {
        message: {
            role: string
            content: string | OpenAI.Chat.Completions.ChatCompletion
        }
    }[]
}

// export async function POST(request: Request) {
//     try {
//         const { file_content, filePath, forkedOwner, forkedRepo, owner, repo, isLastFile, type } = await request.json();
//         const qstashToken: string = process.env.QSTASH_TOKEN as string;
//         const openaiToken: string = process.env.OPENAI_API_KEY as string;

//         if (!qstashToken || !openaiToken) {
//             throw new Error('QSTASH_TOKEN or OPENAI_API_KEY is not set');
//         }

//         const client: Client = new Client({
//             token: qstashToken,
//         });

//         const result = await client.publishJSON({
//             api: {
//                 name: 'llm',
//                 provider: openai({ token: openaiToken }),
//             },
//             body: {
//                 messages: [
//                     {
//                         role: 'system',
//                         content: `
//                             I want you to fix grammatical errors in a markdown file.
//                             Your response should be an array of json objects.
//                             Follow the same rules for grammar correction as previously.
//                         `,
//                     },
//                     { role: 'user', content: file_content },
//                 ],
//                 response_format: { type: 'json_object' },
//                 model: 'gpt-4-turbo-preview',
//                 temperature: 0,
//             },
//             callback: process.env.NEXTAUTH_URL + '/api/gitfix',
//         });

//         return NextResponse.json({
//             message: 'Job is submitted to Upstash Workflow.',
//             qstashMessageId: result.messageId,
//         });
//     } catch (error) {
//         console.error('Error submitting workflow:', error);
//         return NextResponse.json(
//             { message: 'Failed to submit workflow', error: (error as any).message },
//             { status: 500 }
//         );
//     }
// }

export const POST = serve(async (context) => {
    const request: {
        file_content: string
        filePath: string
        forkedOwner: string
        forkedRepo: string
        owner: string
        repo: string
        isLastFile: boolean
        type: string
    } = context.requestPayload as any
    const {
        file_content,
        filePath,
        forkedOwner,
        forkedRepo,
        owner,
        repo,
        isLastFile,
        type,
    } = request

    const qstashToken: string = process.env.QSTASH_TOKEN as string
    const openaiToken: string = process.env.OPENAI_API_KEY as string

    if (!qstashToken || !openaiToken) {
        throw new Error('QSTASH_TOKEN or OPENAI_API_KEY is not set')
    }

    const response = await context.call<OpenAiResponse>(
        `${forkedOwner}#${forkedRepo}#${filePath}`,
        'https://api.openai.com/v1/chat/completions',
        'POST',
        {
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: `
                I want you to fix grammatical errors in a markdown file.
                I will give you the file and you will correct grammatical errors in the text (paragraphs and headers).
                Your response should be an array of json objects.
                Each one of those objects should contain the original line and corrections. 

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
                    "isLastFile": "${isLastFile}"
                    "type": "${type}"
                }
                {original_line, correction}, 
                {original_line, correction}]\}

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
                `,
                },
                { role: 'user', content: file_content },
            ],
            max_tokens: 150,
        },
        { authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    )

    // const corrections = response.choices[0].message
    //     .content as OpenAI.Chat.Completions.ChatCompletion
    // console.log(corrections)
    // const parsedCorrections = parser(corrections, file_content)
    // console.log(parsedCorrections)
})
