// src/app/api/qstash-callback/route.ts

import { NextResponse } from 'next/server';
import { Github_API } from '@/lib/github-api';
import { addFixedFile, isFileFixed } from '@/lib/redis-utils';

export async function POST(request: Request) {
    try {
        const { filePath, fileContent, owner, repo, auth, corrections } = await request.json();

        // Ensure all required fields are present
        if (!filePath || !fileContent || !owner || !repo || !auth || !corrections) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        let parsedCorrections;
        try {
            parsedCorrections = JSON.parse(corrections).corrections;
        } catch (parseError: any) {
            throw new Error(`Failed to parse JSON response: ${parseError.message}`);
        }

        let updatedContent = fileContent;
        for (let i = 0; i < parsedCorrections.length; i++) {
            const { original_line, correction } = parsedCorrections[i];
            const contentIndex = updatedContent.indexOf(original_line);
            if (contentIndex === -1) {
                console.log('Original line missing:', original_line);
                continue;
            }
            const contentIndexEnd = contentIndex + original_line.length;
            updatedContent =
                updatedContent.substring(0, contentIndex) +
                correction +
                updatedContent.substring(contentIndexEnd);
        }

        // Initialize GitHub API
        const github = new Github_API(owner, repo, auth);
        await github.initializeRepoDetails();

        // Update file content in the GitHub repository
        await github.updateFileContent(filePath, updatedContent, owner, repo, false);
        
        // Mark file as fixed
        await addFixedFile(`${owner}@${repo}@${filePath}`);

        return NextResponse.json({ message: 'File updated successfully' }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'Internal server error', error: (error as Error).message }, { status: 500 });
    }
}
