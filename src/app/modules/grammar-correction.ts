import OpenAI from 'openai'

export async function generate_grammatically_correct_content(file_content: string): Promise<string> {
    if (file_content.length > 4e5) {
        throw new Error("File content is too large");
    }
    const key = process.env.OPENAI_API_KEY;
    const openai = new OpenAI({apiKey: key});
    const completion = await openai.chat.completions.create({
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
    })
    let response = completion.choices[0].message.content
    console.log(response)
    let suggestions = JSON.parse(response as string).corrections

    for (let i = 0; i < suggestions.length; i++) {
        const { original_line, correction } = suggestions[i]
        const contentIndex = file_content.indexOf(original_line)
        if (contentIndex == -1) {
            console.log('original line miss')
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