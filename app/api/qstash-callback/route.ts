import { NextResponse, NextRequest } from 'next/server';
import { Github_API } from '@/lib/github-api';
import { generateGrammaticallyCorrectContent } from '@/lib/grammar-correction';
import { addFixedFile, isFileFixed } from '@/lib/redis-utils';

export async function POST(request: NextRequest) {
    try {
        console.log('Received request to fix markdown files');

        // Parse the JSON request body
        const { owner, repo, auth } = await request.json();

        if (!owner || !repo || !auth) {
            return NextResponse.json(
                { message: 'Missing required fields' },
                { status: 400 }
            );
        }

        const github = new Github_API(owner, repo, auth);
        await github.initializeRepoDetails();

        const forkedRepoInfo = await github.forkRepository();
        const forkedOwner = forkedRepoInfo[0];
        const forkedRepo = forkedRepoInfo[1];
        await github.getFileContent();

        let flag = true;
        let counter = 0;
        for (const filePath of Object.keys(github.md_files_content)) {
            const isFixed = await isFileFixed(`${forkedOwner}@${forkedRepo}@${filePath}`);
            if (isFixed) {
                console.log(`File ${filePath} is already fixed, skipping...`);
                continue;
            }
            console.log(`Fixing file: ${filePath}`);
            if (counter > 3) {
                console.log(
                    'Max file limit reached, if you want to process more files, please run the app again.'
                );
                break;
            }
            const originalContent = github.md_files_content[filePath];
            const correctedContent = await generateGrammaticallyCorrectContent(originalContent);
            await github.updateFileContent(
                filePath,
                correctedContent,
                forkedOwner,
                forkedRepo,
                flag
            );
            flag = false;
            counter++;
            await addFixedFile(`${forkedOwner}@${forkedRepo}@${filePath}`);
        }
        if (counter === 0) {
            console.log('No files to fix');
            return NextResponse.json(
                {
                    message: 'There are no markdown files, or all of them are already fixed.',
                },
                { status: 200 }
            );
        }

        const prTitle = 'Fix grammatical errors in markdown files by Gitfix';
        const prBody = 'This pull request fixes grammatical errors in the markdown files. ' +
            'Changes are made by Gitfix, which is an AI-powered application, ' +
            'aims to help developers in their daily tasks.';
        await github.createPullRequest(prTitle, prBody, forkedOwner, forkedRepo);
        return NextResponse.json(
            { message: 'Pull request created successfully' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error handling callback:', error);
        return NextResponse.json(
            { message: 'Internal server error', error: (error as any).message },
            { status: 500 }
        );
    }
}
