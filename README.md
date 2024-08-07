# Overview
GitFix is an AI-powered application that helps developers by correcting grammatical errors in markdown files within their GitHub repositories. It fetches files from a repository, processes them using AI models to generate corrected content, and then submits a pull request (PR) to the repository owner. It fixes 3 files per run, to avoid API abuse. Previously fixed files are stored at [Upstash Redis](https://upstash.com/pricing/redis), so when a repository is asked again, different 3 files are selected and and processed. 


## Tech Stack and Tools

- Next.js: Framework for building the frontend and backend.
- OpenAI: For natural language processing and grammar correction.
- GitHub API: For interacting with GitHub repositories and creating pull requests.
- QStash: For handling long-running operations.
- NextAuth: For authentication with GitHub.
## Prerequisites

- Node.js
- npm or yarn
- GitHub account
- GitHub personal access token
- Github OAuth application
- NextAuth secret

## Installation

1- Clone the repository:

```bash
git clone <repository-url>
cd <repository-directory>
```

2- Install dependencies:

```bash
npm install
```
3 - Configure environment variables:

Create a .env file and add the following environment variables:

```env

NEXTAUTH_SECRET=
NEXTAUTH_URL=

GITHUB_TOKEN=
GITHUB_CLIENT_ID= 
GITHUB_CLIENT_SECRET=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

QSTASH_URL=
QSTASH_TOKEN=

```

4 - Running the Application:

Start the development server.

```bash

npm run dev
```
Open your browser and navigate to http://localhost:3000.

**Important note:** In this project, hosting your application on a public server is strongly recommended. QStash requires a publicly accessible server, also handling Github OAuth applications on a public server is a better exercise than handling them on the localhost. You can use [Vercel Hobby Plan](https://vercel.com/docs/accounts/plans/hobby), it is perfectly fine with our purposes and it doesn't require a payment or entering billing information. You can modfy the project according your needs, however we suggest you to host them on a website.

# Backend Architecture
## 1- API Endpoints

### auth:
Handles Github authentication by using [NextAuth](https://next-auth.js.org/). It basically manages login process and redirects user to repository searching part.

### gitfix:
Handles the main functionality of fetching files from a repository and processing them. It streams updates to the frontend as the processing progresses.

Key Functions:

  - GitHub Authentication: Checks if the user is authenticated, if not it doesn't allow user to perform any actions.
  - File Fetching and Processing : Retrieves markdown files from the repository, extracts the text content and submit files to AI model by using Upstash QStash. 
  - Progress Streaming: Streams progress updates to the frontend.
  
### status:
Handles the updating and streaming the current status of operations. It is responsible for recieving logs from backend and sending them to frontend. 

## 2- Github Integration

The `github-api.ts` file handles the interactions with Github API. Every Github operation is implemented in a seperate function. Implemented operations are:
- Fetching markdown files
- Extracting text content
- Forking repository
- Commiting and uploading an updated file
- Creating a branch
- Creating PR

Besides these functions, helper functions are also implemented to improve readability. We won't dive into details, but if you are curious about implemenation of those functions, you can examine the `github-api.ts` file.

## 3- QStash Functionality
QStash is used for handling long-running operations, particularly the AI model processing tasks. This ensures that the operations are handled asynchronously and do not exceed the execution limits of the deployment environment (We used the hobby plan of Vercel, so by using QStash you don't need to pay for deployment). This part can be explained in 3 main steps:
- Task Submission : When a file is submitted for processing, a task is created and submitted to QStash.
- Callback Handling: Once the task is completed, QStash triggers a POST request to the callback endpoint in the backend, which was set when you submitted the task in the first step.
- Result Processing: The callback endpoint processes the results and handles the POST request.


# Contributing

Contributions are welcome! Please open an issue or submit a pull request if you have any improvements or bug fixes.