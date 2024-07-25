// src/app/api/qstash-callback/route.ts

import { NextResponse } from 'next/server'
import { Github_API } from '@/lib/github-api'
import { addFixedFile, isFileFixed } from '@/lib/redis-utils'
import base64 from 'base-64'

export async function POST(request: Request) {
    try {
        const body = await request.text()
        // Decode the base64 string
        const decodedBody = base64.decode(body)
        // Parse the JSON content
        const requestBody = JSON.parse(decodedBody)
        const { choices } = requestBody
        const correctedContent = choices[0]?.message?.content
        let parsedCorrections
        try {
            parsedCorrections = JSON.parse(correctedContent).corrections
        } catch (parseError: any) {
            throw new Error(
                `Failed to parse JSON response: ${parseError.message}`
            )
        }

        return NextResponse.json(
            { corrections: parsedCorrections },
            { status: 200 }
        )
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            {
                message: 'Internal server error',
                error: (error as Error).message,
            },
            { status: 500 }
        )
    }
}

// let updatedContent = fileContent;
// for (let i = 0; i < parsedCorrections.length; i++) {
//     const { original_line, correction } = parsedCorrections[i];
//     const contentIndex = updatedContent.indexOf(original_line);
//     if (contentIndex === -1) {
//         console.log('Original line missing:', original_line);
//         continue;
//     }
//     const contentIndexEnd = contentIndex + original_line.length;
//     updatedContent =
//         updatedContent.substring(0, contentIndex) +
//         correction +
//         updatedContent.substring(contentIndexEnd);
// }

// // Initialize GitHub API
// const github = new Github_API(owner, repo, auth);
// await github.initializeRepoDetails();

// // Update file content in the GitHub repository
// await github.updateFileContent(filePath, updatedContent, owner, repo, false);

// // Mark file as fixed
// await addFixedFile(`${owner}@${repo}@${filePath}`);

//TODO:

// import { NextRequest, NextResponse } from 'next/server';
// import { createClient } from '@upstash/qstash';
// import { Octokit } from '@octokit/rest';
// import { parse } from 'cookie';
// import { buffer } from 'micro';
// import base64 from 'base-64';

// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

// const octokit = new Octokit({
//   auth: process.env.GITHUB_ACCESS_TOKEN,
// });

// const qstashClient = createClient({
//   token: process.env.QSTASH_TOKEN,
// });

// export default async function handler(req: NextRequest, res: NextResponse) {
//   if (req.method === 'POST') {
//     try {
//       // Parse and verify the QStash signature
//       const rawBody = await buffer(req);
//       const signature = req.headers['upstash-signature'] as string;
//       const isVerified = await qstashClient.verifySignature({
//         rawBody,
//         signature,
//       });

//       if (!isVerified) {
//         return res.status(401).json({ error: 'Unauthorized' });
//       }

//       // Decode the base64-encoded body
//       const requestBody = JSON.parse(base64.decode(req.body.toString('utf-8')));

//       const { choices } = requestBody;

//       // Extract the corrected content
//       const correctedContent = choices[0]?.message?.content;

//       // Use the corrected content in your application logic
//       console.log('Corrected Content:', correctedContent);

//       // Continue with your application logic, such as updating GitHub files or other operations
//       // Example: Update a GitHub file with the corrected content

//       const owner = 'your-github-username';
//       const repo = 'your-repo-name';
//       const path = 'path/to/your/file.md';
//       const branch = 'main';

//       const { data: fileData } = await octokit.repos.getContent({
//         owner,
//         repo,
//         path,
//         ref: branch,
//       });

//       const fileSha = fileData.sha;
//       const fileContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

//       // Update the file content with the corrected content
//       const updatedContent = fileContent.replace(/The Redis-MinIO Proxy Blob Storage System represents a significant advancement in data storage solutions, blending speed, scalability, and reliability./g, correctedContent);

//       await octokit.repos.createOrUpdateFileContents({
//         owner,
//         repo,
//         path,
//         message: 'Updated file with corrected content',
//         content: Buffer.from(updatedContent).toString('base64'),
//         sha: fileSha,
//         branch,
//       });

//       return res.status(200).json({ message: 'File updated successfully' });
//     } catch (error) {
//       console.error('Error processing request:', error);
//       return res.status(500).json({ error: 'Internal Server Error' });
//     }
//   }

//   return res.status(405).json({ error: 'Method Not Allowed' });
// }
