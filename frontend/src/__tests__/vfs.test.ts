import { describe, it, expect } from 'vitest'
import { VirtualFileSystem } from '../services/virtual-shell/vfs'

describe('VirtualFileSystem', () => {
  const vfs = new VirtualFileSystem()
  const catalog = ['ark', 'articles', 'about']

  it('resolves tilde ~ to /home/liangchen', () => {
    expect(vfs.resolvePath('/', '~')).toBe('/home/liangchen')
    expect(vfs.resolvePath('/home/liangchen', '.')).toBe('/home/liangchen')
  })

  it('resolves relative paths and parent paths', () => {
    expect(vfs.resolvePath('/', 'docs')).toBe('/docs')
    expect(vfs.resolvePath('/docs', '..')).toBe('/')
    expect(vfs.resolvePath('/home/liangchen', '..')).toBe('/home')
  })

  it('returns null for nonexistent paths', () => {
    expect(vfs.resolvePath('/', 'invalid_dir')).toBeNull()
  })

  it('lists directory contents including virtual documents', () => {
    const docs = vfs.listDir('/docs', catalog)
    expect(docs).toContain('ark.md')
    expect(docs).toContain('articles.md')
    expect(docs).toContain('about.md')

    const root = vfs.listDir('/', catalog)
    expect(root).toContain('bin/')
    expect(root).toContain('docs/')
    expect(root).toContain('home/')
    expect(root).toContain('etc/')
  })

  it('checks directory existence with isDir', () => {
    expect(vfs.isDir('/')).toBe(true)
    expect(vfs.isDir('~')).toBe(true)
    expect(vfs.isDir('/home/liangchen')).toBe(true)
    expect(vfs.isDir('/docs')).toBe(true)
    expect(vfs.isDir('/bin')).toBe(true)
    expect(vfs.isDir('/etc')).toBe(true)
    expect(vfs.isDir('/etc/motd')).toBe(false)
    expect(vfs.isDir('/invalid')).toBe(false)
  })

  it('lists system binaries and config files', () => {
    const bin = vfs.listDir('/bin', catalog)
    expect(bin).toContain('bat*')
    expect(bin).toContain('glow*')
    expect(bin).toContain('neofetch*')
    expect(bin).toContain('tldr*')
    expect(bin).toContain('ls*')
    expect(bin).toContain('cat*')

    const etc = vfs.listDir('/etc', catalog)
    expect(etc).toContain('motd')
    expect(etc).toContain('os-release')

    const home = vfs.listDir('/home', catalog)
    expect(home).toContain('liangchen/')

    const invalid = vfs.listDir('/nonexistent', catalog)
    expect(invalid).toEqual([])
  })

  it('resolves special paths and files correctly', () => {
    expect(vfs.resolvePath('/', '~/docs')).toBe('/docs')
    expect(vfs.resolvePath('/home/liangchen', 'docs')).toBe('/docs')
    expect(vfs.resolvePath('/docs', 'ark.md', catalog)).toBe('/docs/ark.md')
    expect(vfs.resolvePath('/docs', 'nonexistent.md', catalog)).toBeNull()
    expect(vfs.resolvePath('/etc', 'motd')).toBe('/etc/motd')
    expect(vfs.resolvePath('/bin', 'bat')).toBe('/bin/bat')
    expect(vfs.resolvePath('/home/liangchen', '../../..')).toBe('/')
  })
})
