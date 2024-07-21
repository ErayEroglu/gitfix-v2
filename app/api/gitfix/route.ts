import { NextApiRequest, NextApiResponse } from 'next';
import { Github_API } from '@/lib/github-api';
import { generate_grammatically_correct_content } from '@//lib/grammar-correction';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // Extract necessary data from the request body
    const { owner, repo, auth, branch_name, pr_title, pr_body } = req.body;

    if (!owner || !repo || !auth || !branch_name || !pr_title || !pr_body) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Initialize GitHub API
    const github = new Github_API(owner, repo, auth);
    await github.initializeRepoDetails();

    // Fetch and update Markdown files content
    await github.get_file_content();
    for (const file_path of Object.keys(github.md_files_content)) {
      const original_content = github.md_files_content[file_path];
      const corrected_content = await generate_grammatically_correct_content(original_content);
      await github.update_file_content(file_path, corrected_content, branch_name);
    }

    // Create a pull request
    await github.create_pull_request(pr_title, pr_body);

    return res.status(200).json({ message: 'Pull request created successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error', error: (error as any).message });
  }
};

export default handler;
