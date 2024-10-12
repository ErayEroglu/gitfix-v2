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

export const POST = serve<{originalContent: string, filePath: string, forkedOwner: string, forkedRepo: string, owner: string, repo: string, isLastFile: boolean, type: string}>(
    async (context) => {
        try{

        
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

        const qstashToken = process.env.QSTASH_TOKEN;
        const openaiToken = process.env.OPENAI_API_KEY;

        if (!qstashToken || !openaiToken) {
            throw new Error('Missing QSTASH_TOKEN or OPENAI_API_KEY');
        }

        // Step 3: Prepare the prompt for the OpenAI API
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
        `;

        // Step 4: Call the OpenAI API
        const response = await context.call<OpenAiResponse>(
            'markdown grammar correction',
            'https://api.openai.com/v1/chat/completions',
            'POST',
            {
                model: 'gpt-4-turbo',
                messages: [
                    { role: 'system', content: 'You are a grammar correction assistant.' },
                    { role: 'user', content: prompt },
                    { role: 'user', content: originalContent },
                ],
            },
            { authorization: `Bearer ${openaiToken}` }
        );

        // Step 5: Extract and return the correction results
        const corrections = response.choices[0].message.content;
        console.log('Workflow finished, corrections:', corrections);
    } catch (error) {
        console.error('Error in the workflow endpoint:', error);
    }
})