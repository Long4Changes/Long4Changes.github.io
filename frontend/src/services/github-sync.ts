export const GITHUB_TOKEN_KEY = 'cyberkb_github_pat'
export const DEFAULT_REPO_OWNER = 'Long4Changes'
export const DEFAULT_REPO_NAME = 'Long4Changes.github.io'
export const DEFAULT_BRANCH = 'main'
export const DEFAULT_CONTENT_PATH = 'backend/content'

export function getGitHubToken(): string | null {
  try {
    return localStorage.getItem(GITHUB_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setGitHubToken(token: string): void {
  try {
    localStorage.setItem(GITHUB_TOKEN_KEY, token.trim())
  } catch {
    // Ignore local storage error
  }
}

export function clearGitHubToken(): void {
  try {
    localStorage.removeItem(GITHUB_TOKEN_KEY)
  } catch {
    // Ignore
  }
}

export function utf8ToBase64(str: string): string {
  return window.btoa(unescape(encodeURIComponent(str)))
}

export interface GitHubSyncResult {
  success: boolean
  message: string
  commitSha?: string
  commitUrl?: string
}

async function getFileSha(
  filename: string,
  token: string,
  owner: string = DEFAULT_REPO_OWNER,
  repo: string = DEFAULT_REPO_NAME
): Promise<string | null> {
  const cleanName = filename.endsWith('.md') ? filename : `${filename}.md`
  const path = `${DEFAULT_CONTENT_PATH}/${cleanName}`
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
    if (res.ok) {
      const data = await res.json()
      return data.sha || null
    }
  } catch {
    // File probably doesn't exist
  }
  return null
}

export async function commitDocumentToGitHub(
  filename: string,
  content: string,
  owner: string = DEFAULT_REPO_OWNER,
  repo: string = DEFAULT_REPO_NAME,
  branch: string = DEFAULT_BRANCH
): Promise<GitHubSyncResult> {
  const token = getGitHubToken()
  if (!token) {
    return {
      success: false,
      message: 'GitHub Token not configured. Run "git-token set <token>" to enable two-way sync.'
    }
  }

  const cleanName = filename.endsWith('.md') ? filename : `${filename}.md`
  const path = `${DEFAULT_CONTENT_PATH}/${cleanName}`
  const existingSha = await getFileSha(cleanName, token, owner, repo)

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
  const bodyData: Record<string, any> = {
    message: `docs(web-terminal): update ${cleanName} via web vim`,
    content: utf8ToBase64(content),
    branch
  }

  if (existingSha) {
    bodyData.sha = existingSha
  }

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify(bodyData)
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'HTTP ' + res.status }))
      return {
        success: false,
        message: `GitHub API error: ${err.message || res.statusText}`
      }
    }

    const data = await res.json()
    const commitSha = data.commit?.sha || ''
    const commitUrl = data.commit?.html_url || ''
    return {
      success: true,
      commitSha,
      commitUrl,
      message: `Committed ${cleanName} to GitHub (${commitSha.slice(0, 7)}).`
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Network error syncing with GitHub: ${err.message}`
    }
  }
}

export async function deleteDocumentFromGitHub(
  filename: string,
  owner: string = DEFAULT_REPO_OWNER,
  repo: string = DEFAULT_REPO_NAME,
  branch: string = DEFAULT_BRANCH
): Promise<GitHubSyncResult> {
  const token = getGitHubToken()
  if (!token) {
    return {
      success: false,
      message: 'GitHub Token not configured.'
    }
  }

  const cleanName = filename.endsWith('.md') ? filename : `${filename}.md`
  const path = `${DEFAULT_CONTENT_PATH}/${cleanName}`
  const existingSha = await getFileSha(cleanName, token, owner, repo)

  if (!existingSha) {
    return {
      success: false,
      message: `File ${cleanName} not found on GitHub.`
    }
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        message: `docs(web-terminal): remove ${cleanName} via web terminal`,
        sha: existingSha,
        branch
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'HTTP ' + res.status }))
      return {
        success: false,
        message: `GitHub API error deleting: ${err.message || res.statusText}`
      }
    }

    const data = await res.json()
    return {
      success: true,
      commitSha: data.commit?.sha,
      message: `Deleted ${cleanName} from GitHub.`
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Network error deleting from GitHub: ${err.message}`
    }
  }
}
