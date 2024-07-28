import { NextResponse } from 'next/server'
import { Github_API } from '@/lib/github-api'
import { addFixedFile, isFileFixed } from '@/lib/redis-utils'
import { Client, openai, upstash } from '@upstash/qstash'
import OpenAI from 'openai'

export async function GET(request: Request) {
    try {
        console.log('Received request to fix markdown files')

        // Parse the JSON request body
        const { searchParams } = new URL(request.url);
        const owner = searchParams.get('owner');
        const repo = searchParams.get('repo');
        const auth = searchParams.get('auth');


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

        let flag: boolean = true
        let counter = 0
        for (const filePath of Object.keys(github.md_files_content)) {
            const isFixed = await isFileFixed(
                forkedOwner + '@' + forkedRepo + '@' + filePath
            )
            if (isFixed) {
                console.log(`File ${filePath} is already fixed, skipping...`)
                continue
            }
            console.log(`Fixing file: ${filePath}`)
            if (counter > 3) {
                console.log(
                    'Max file limit reached, if you want to process more files, ' +
                        'please run the app again.'
                )
                break
            }
            const originalContent = github.md_files_content[filePath]
            const metadata = { filePath, originalContent, forkedOwner, forkedRepo, owner, repo, auth }
            await publishIntoQStash(originalContent, metadata)
            counter++
        }
        if (counter === 0) {
            console.log('No files to fix')
            return NextResponse.json(
                {
                    message:
                        'There is not any markdown file, or all of them are already fixed.',
                },
                { status: 200 }
            )
        }

        return NextResponse.json(
            { message: 'Pull request created successfully' },
            { status: 200 }
        )
    } catch (error) {
        console.error('Error handling GET request:', error)
        return NextResponse.json(
            { message: 'Internal server error', error: (error as any).message },
            { status: 500 }
        )
    }
}

export async function POST(request: Request){
    try {
        const body = await request.json()
        console.log('Received body:', body)
        const decodedBody = JSON.parse(
            atob(body.body)
        ) as OpenAI.Chat.Completions.ChatCompletion

        // const { filePath, originalContent, forkedOwner, forkedRepo, owner, repo, auth } = body.metadata || {}
        // if (!filePath || !originalContent || !forkedOwner || !forkedRepo || !owner || !repo || !auth) {
        //     throw new Error('Missing metadata fields')
        // }
        // console.log('Received metadata:', filePath, forkedOwner, forkedRepo, owner, repo, auth)
        // const correctedContent = await parser(decodedBody, originalContent);

        // const github = new Github_API(owner, repo, auth);
        // await github.updateFileContent(filePath, correctedContent, forkedOwner, forkedRepo, false);
        // await addFixedFile(`${forkedOwner}@${forkedRepo}@${filePath}`);


        console.log('the opeani answer : ',decodedBody)
        const prTitle = 'Fix grammatical errors in markdown files by Gitfix'
        const prBody =
            'This pull request fixes grammatical errors in the markdown files. ' +
            'Changes are made by Gitfix, which is an AI-powered application, ' +
            'aims to help developers in their daily tasks.'
        // await github.createPullRequest(prTitle, prBody, forkedOwner, forkedRepo)
        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error('Error processing callback:', error)
        return new Response('Internal server error', { status: 500 })
    }
}

async function publishIntoQStash(file_content: string, metadata : any) {
    const qstashToken = process.env.QSTASH_TOKEN as string;
    const openaiToken = process.env.OPENAI_API_KEY as string;
    if (!qstashToken || !openaiToken) {
        throw new Error('QSTASH_TOKEN or OPENAI_API_KEY is not set\n' + qstashToken + "\n" + openaiToken);
    }

    const client = new Client({
        token: qstashToken
    })

    const result = await client.publishJSON({
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
      
                \{corrections : [{original_line, correction}, {original_line, correction}]\}
      
                You should only correct what is given in the file, do not add any original text.
                DO NOT alter any of the code blocks, codes, paths or links.
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
            metadata: metadata,
        },
        callback: process.env.NEXTAUTH_URL + '/api/gitfix',
    })
    return NextResponse.json({
        message: 'API response is generated',
        qstashMessageId: result.messageId,
    })
}

async function parser(completion: OpenAI.Chat.Completions.ChatCompletion, file_content: string) {
    const response = completion.choices[0]?.message?.content

    let suggestions
    try {
        suggestions = JSON.parse(response as string).corrections
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
