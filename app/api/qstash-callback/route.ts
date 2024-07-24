import { NextApiRequest, NextApiResponse } from 'next';
import { Github_API } from '@/lib/github-api';
import { addFixedFile, isFileFixed } from '@/lib/redis-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { filePath, fileContent, owner, repo, auth, corrections } = req.body;

        // Ensure all required fields are present
        if (!filePath || !fileContent || !owner || !repo || !auth || !corrections) {
            return res.status(400).json({ message: 'Missing required fields' });
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

        res.status(200).json({ message: 'File updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error', error: (error as any).message });
    }
}
