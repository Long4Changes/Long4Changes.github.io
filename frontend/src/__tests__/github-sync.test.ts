import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getGitHubToken,
  setGitHubToken,
  clearGitHubToken,
  commitDocumentToGitHub,
  deleteDocumentFromGitHub,
  utf8ToBase64
} from '../services/github-sync'

describe('github-sync service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearGitHubToken()
  })

  it('manages github token in local storage', () => {
    expect(getGitHubToken()).toBeNull()
    setGitHubToken('ghp_test_token_12345')
    expect(getGitHubToken()).toBe('ghp_test_token_12345')
    clearGitHubToken()
    expect(getGitHubToken()).toBeNull()
  })

  it('correctly encodes unicode text to base64', () => {
    const text = '# 你好，世界\n这是一篇中文测试文档。'
    const b64 = utf8ToBase64(text)
    expect(b64).toBeDefined()
    // Decode back to verify
    const decoded = decodeURIComponent(escape(atob(b64)))
    expect(decoded).toBe(text)
  })

  it('returns failure when token is not configured', async () => {
    const res = await commitDocumentToGitHub('test.md', '# Content')
    expect(res.success).toBe(false)
    expect(res.message).toContain('GitHub Token not configured')
  })

  it('creates new file on GitHub when file does not exist (404 on GET)', async () => {
    setGitHubToken('ghp_mock_token')

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    // 1. GET file info returns 404 (file doesn't exist yet)
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }))
    // 2. PUT creates new file
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          content: { name: 'test.md', path: 'backend/content/test.md' },
          commit: { sha: 'commit_sha_123', html_url: 'https://github.com/commit/123' }
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const res = await commitDocumentToGitHub('test.md', '# New Content')
    expect(res.success).toBe(true)
    expect(res.commitSha).toBe('commit_sha_123')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('updates existing file on GitHub with its sha', async () => {
    setGitHubToken('ghp_mock_token')

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    // 1. GET file info returns 200 with existing sha
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ sha: 'existing_file_sha_456' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    // 2. PUT updates file with existing sha
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          commit: { sha: 'updated_commit_sha_789' }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const res = await commitDocumentToGitHub('test.md', '# Updated Content')
    expect(res.success).toBe(true)
    expect(res.commitSha).toBe('updated_commit_sha_789')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('deletes file on GitHub with its sha', async () => {
    setGitHubToken('ghp_mock_token')

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    // 1. GET file sha
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ sha: 'delete_sha_999' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    // 2. DELETE file
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ commit: { sha: 'deleted_commit_sha_000' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    const res = await deleteDocumentFromGitHub('test.md')
    expect(res.success).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
