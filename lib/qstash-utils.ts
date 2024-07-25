import { Client, openai } from '@upstash/qstash'

const client = new Client({
    token: process.env.QSTASH_TOKEN as string,
})

export async function publishGrammarCorrectionJob(
    filePath: string,
    fileContent: string,
    callbackUrl: string
) {
    const result = await client.publishJSON({
        api: {
            name: 'llm',
            provider: openai({ token: process.env.OPENAI_API_KEY as string }),
        },
        body: {
            model: 'gpt-4-turbo',
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
                { role: 'user', content: fileContent },
            ],
            response_format: { type: 'json_object' },
            temperature: 0,
        },
        callback: callbackUrl,
    })
    console.log(result)
    return result
}
