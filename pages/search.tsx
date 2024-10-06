import React, { useState, useEffect, useCallback } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertCircle } from "lucide-react"
import UpstashLogo from '@/components/ui/upstash-logo'
import PoweredBy from '@/components/ui/powered-by'


interface RepoInfo {
  owner: string
  repo: string
  type: 0 | 1
  filePath?: string
}

export default function Search() {
  const [url, setUrl] = useState('')
  const [owner, setOwner] = useState('')
  const [repo, setRepo] = useState('')
  const [filePath, setFilePath] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [polling, setPolling] = useState(false)

  const extractRepoInfo = useCallback((url: string): RepoInfo | null => {
    const cleanedUrl = url.endsWith('/') ? url.slice(0, -1) : url
    const urlParts = cleanedUrl.split('/')

    if (urlParts.length === 5 && urlParts[2] === 'github.com') {
      return { owner: urlParts[3], repo: urlParts[4], type: 1 }
    }

    if (urlParts.length > 5 && urlParts[2] === 'github.com' && urlParts[5] === 'blob') {
      return {
        owner: urlParts[3],
        repo: urlParts[4],
        type: 0,
        filePath: urlParts.slice(7).join('/')
      }
    }

    return null
  }, [])

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null
    if (polling) {
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(`/api/status?id=${owner}@${repo}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          })
          if (response.ok) {
            const data = await response.json()
            if (data.status === 'completed') {
              setLogs((prevLogs) => [...prevLogs, 'Pull request created, you can check your repository.'])
              setPolling(false)
              setMessage('All files are processed. The pull request has been created.')
            }
          } else {
            console.error('Failed to fetch status:', await response.text())
          }
        } catch (error) {
          console.error('Polling error:', error)
        }
      }, 15000)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [polling, owner, repo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const repoInfo = extractRepoInfo(url)
    if (repoInfo) {
      setOwner(repoInfo.owner)
      setRepo(repoInfo.repo)
      if (repoInfo.type === 0) {
        setFilePath(repoInfo.filePath as string)
      }
      setIsLoading(true)
      setMessage('')
      setLogs([])
      try {
        const endpoint = filePath
          ? `/api/gitfix?owner=${repoInfo.owner}&repo=${repoInfo.repo}&type=${repoInfo.type}&filePath=${filePath}`
          : `/api/gitfix?owner=${repoInfo.owner}&repo=${repoInfo.repo}&type=${repoInfo.type}`
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        if (response.ok) {
          setPolling(true)
          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let accumulatedData = ''

          if (reader) {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              accumulatedData += decoder.decode(value, { stream: true })
              const messages = accumulatedData.split('#').filter(Boolean)

              messages.forEach((message) => {
                try {
                  const parsedData = JSON.parse(message)
                  setLogs((prevLogs) => [...prevLogs, parsedData.message])
                } catch (parseError) {
                  console.warn('Parsing error:', parseError)
                }
              })

              accumulatedData = ''
            }
          }
          setMessage('Repository analysis completed, we are starting to process markdown files.')
        } else {
          const errorData = await response.json()
          console.error('Error:', errorData)
          setMessage(`Error: ${errorData.message}`)
        }
      } catch (error) {
        console.error('Error:', error)
        setMessage('An unexpected error occurred.')
      } finally {
        setIsLoading(false)
      }
    } else {
      setMessage('Please check the link')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
        <div className="flex items-center justify-center space-x-4"> {/* Flexbox container with space between items */}
          <UpstashLogo height={40} />
          <CardTitle className="text-3xl font-bold text-center text-gray-100">GITFIX</CardTitle>
        </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Input
                type="text"
                placeholder="Enter repository URL or file link"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm"
              />
            </div>
            <div>
              <Button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                    Processing
                  </>
                ) : (
                  'Submit'
                )}
              </Button>
            </div>
          </form>

          {message && (
            <Alert className="mt-4" variant={isLoading ? "default" : message.startsWith('Error') ? "destructive" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Status</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {logs.length > 0 && (
            <Card className="mt-6 max-h-64 overflow-y-auto">
              <CardHeader>
                <CardTitle className="text-lg">Processing Logs</CardTitle>
              </CardHeader>
              <CardContent>
                {logs.map((log, index) => (
                  <p key={index} className="text-sm mb-2 text-gray-600">{log}</p>
                ))}
              </CardContent>
            </Card>
          )}
        <div className="flex justify-center mt-8">
          <PoweredBy />
        </div>
        </CardContent>
      </Card>
    </div>
  )
}
