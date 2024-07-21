import { Github_API } from './github-api'
import { generate_grammatically_correct_content } from './grammar-correction'

async function* gitfix(
    owner: string,
    repo: string,
    demo_mode: boolean,
    config: any
): AsyncGenerator {
    const path = owner + '/' + repo
    const updated_files: { [key: string]: any } = {}
    //TODO: Redis part

    console.log(`Starting gitfix for ${path}`)
    const github = new Github_API(owner, repo, config.auth)

    try {
        // Initialize repository details
        await github.initializeRepoDetails()
        await github.get_file_content()
    } catch (error) {
        yield `Error: Could not read the repository metadata, aborting!\n\n`
        console.error(error)
        return
    }

    // Generate grammatically correct content for each md file
    for (const key in github.md_files_content) {
        const file_path = key
        const content = github.md_files_content[key]
        console.log(`Processing ${file_path}`)
        try {
            const updated_content =
                await generate_grammatically_correct_content(content)
            updated_files[file_path] = updated_content
        } catch (error) {
            yield `Error: Could not generate grammatically correct content for ${file_path}\n\n`
            console.error(error)
        }
    }

    // If no files were updated, exit
    if (Object.keys(updated_files).length === 0) {
        yield `No files were updated.\n\n`
        return
    }

    // Create a new branch
    const branch_name = 'gitfix-updates'
    try {
        await github.create_branch(branch_name)
        yield `Created branch: ${branch_name}\n\n`
    } catch (error) {
        yield `Error: Could not create branch ${branch_name}, aborting!\n\n`
        console.error(error)
        return
    }

    // Update files in the new branch
    for (const file_path in updated_files) {
        try {
            await github.update_file_content(
                file_path,
                updated_files[file_path],
                branch_name
            )
            yield `Updated file: ${file_path}\n\n`
        } catch (error) {
            yield `Error: Could not update file ${file_path} in branch ${branch_name}\n\n`
            console.error(error)
        }
    }
    // Create a pull request
    try {
        await github.create_pull_request(
            'Automatic grammatical corrections by GitFix',
            'This PR includes automatic grammatical corrections for markdown files.'
        )
        yield `Success: Created pull request.\n\n`
    } catch (error) {
        yield `Error: Could not create pull request, aborting!\n\n`
        console.error(error)
        return
    }
}

export default gitfix
