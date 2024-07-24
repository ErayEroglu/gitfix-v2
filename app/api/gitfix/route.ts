// import { NextResponse } from 'next/server'
// import { Github_API } from '@/lib/github-api'
// import { generateGrammaticallyCorrectContent } from '@/lib/grammar-correction'
// import { addFixedFile, isFileFixed } from '@/lib/redis-utils'

// export async function POST(request: Request) {
//     try {
//         console.log('Received request to fix markdown files')

//         // Parse the JSON request body
//         const { owner, repo, auth } = await request.json()

//         if (!owner || !repo || !auth) {
//             return NextResponse.json(
//                 { message: 'Missing required fields' },
//                 { status: 400 }
//             )
//         }

//         const github = new Github_API(owner, repo, auth)
//         await github.initializeRepoDetails()

//         const forked_repo_info = await github.forkRepository()
//         const forkedOwner = forked_repo_info[0]
//         const forkedRepo = forked_repo_info[1]
//         await github.getFileContent()
        
//         let flag: boolean = true
//         let counter = 0
//         for (const filePath of Object.keys(github.md_files_content)) {
//             const isFixed = await isFileFixed(
//                 forkedOwner + '@' + forkedRepo + '@' + filePath
//             )
//             if (isFixed) {
//                 console.log(`File ${filePath} is already fixed, skipping...`)
//                 continue
//             }
//             console.log(`Fixing file: ${filePath}`)
//             if (counter > 3) {
//                 console.log(
//                     'Max file limit reached, if you want to process more files, ' +
//                         'please run the app again.'
//                 )
//                 break
//             }
//             const original_content = github.md_files_content[filePath]
//             const corrected_content =
//                 await generateGrammaticallyCorrectContent(original_content)
//             await github.updateFileContent(
//                 filePath,
//                 corrected_content,
//                 forkedOwner,
//                 forkedRepo,
//                 flag
//             )
//             flag = false
//             counter++
//             await addFixedFile(forkedOwner + '@' + forkedRepo + '@' + filePath)
//         }
//         if (counter === 0) {
//             console.log('No files to fix')
//             return NextResponse.json(
//                 {
//                     message:
//                         'There is not any markdown file, or all of them are already fixed.',
//                 },
//                 { status: 200 }
//             )
//         }

//         const prTitle = 'Fix grammatical errors in markdown files by Gitfix'
//         const prBody =
//             'This pull request fixes grammatical errors in the markdown files. ' +
//             'Changes are made by Gitfix, which is an AI-powered application, ' +
//             'aims to help developers in their daily tasks.'
//         await github.createPullRequest(
//             prTitle,
//             prBody,
//             forkedOwner,
//             forkedRepo
//         )
//         return NextResponse.json(
//             { message: 'Pull request created successfully' },
//             { status: 200 }
//         )
//     } catch (error) {
//         console.error(error)
//         return NextResponse.json(
//             { message: 'Internal server error', error: (error as any).message },
//             { status: 500 }
//         )
//     }
// }



// api/gitfix/route.ts

import { NextResponse } from 'next/server';
import { Github_API } from '@/lib/github-api';
import { addFixedFile, isFileFixed } from '@/lib/redis-utils';
import { publishGrammarCorrectionJob } from '@/lib/qstash-utils'; // Assume you put the QStash logic here

export async function POST(request: Request) {
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

        const forked_repo_info = await github.forkRepository();
        const forkedOwner = forked_repo_info[0];
        const forkedRepo = forked_repo_info[1];
        await github.getFileContent();
        
        let counter = 0;
        for (const filePath of Object.keys(github.md_files_content)) {
            const isFixed = await isFileFixed(
                forkedOwner + '@' + forkedRepo + '@' + filePath
            );
            if (isFixed) {
                console.log(`File ${filePath} is already fixed, skipping...`);
                continue;
            }
            console.log(`Fixing file: ${filePath}`);
            if (counter > 3) {
                console.log(
                    'Max file limit reached, if you want to process more files, ' +
                    'please run the app again.'
                );
                break;
            }

            const originalContent = github.md_files_content[filePath];
            const callbackUrl = process.env.NEXTAUTH_URL + `/api/qstash-callback`; // Update with your actual callback URL
            await publishGrammarCorrectionJob(filePath, originalContent, callbackUrl);
            counter++;
        }

        if (counter === 0) {
            console.log('No files to fix');
            return NextResponse.json(
                {
                    message: 'There is not any markdown file, or all of them are already fixed.',
                },
                { status: 200 }
            );
        }

        return NextResponse.json(
            { message: 'Grammar correction jobs published successfully' },
            { status: 200 }
        );
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { message: 'Internal server error', error: (error as any).message },
            { status: 500 }
        );
    }
}
