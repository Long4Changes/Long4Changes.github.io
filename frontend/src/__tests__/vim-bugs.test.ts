import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import VimEditor from '../components/VimEditor.vue'
import Terminal from '../components/Terminal.vue'
import { clearAuthSession, setApiBase } from '../services/api'

describe('Vim / Neovim Bug Reproduction and Diagnostic Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearAuthSession()
    setApiBase('')

    if (typeof Range !== 'undefined') {
      if (!Range.prototype.getClientRects) {
        Range.prototype.getClientRects = () => [] as unknown as DOMRectList
      }
      if (!Range.prototype.getBoundingClientRect) {
        Range.prototype.getBoundingClientRect = () => ({
          top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}
        }) as DOMRect
      }
    }
  })

  // Bug 1: vim should only be accessible to logged in root, guest should be blocked
  it('[BUG 1] guest running vim/nvim should be blocked with permission denied', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark', 'articles'], isActive: true },
      attachTo: document.body
    })
    const input = wrapper.find('input')
    await input.setValue('vim ark')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Vim editor should NOT be opened for guest
    const editor = document.body.querySelector('[data-testid="vim-editor"]')
    expect(editor).toBeNull()

    // Terminal should output permission denied error message
    expect(wrapper.text()).toContain("Permission denied: 'vim' requires root")
    wrapper.unmount()
  })

  // Bug 2: pressing 'i' enters insert mode, then pressing 'Escape' must return to NORMAL mode
  it('[BUG 2] pressing i enters INSERT mode, and pressing Escape returns to NORMAL mode', async () => {
    const wrapper = mount(VimEditor, {
      props: {
        slug: 'ark',
        filename: 'ark.md',
        initialContent: 'Hello world',
        role: 'root',
        isNvim: false
      },
      attachTo: document.body
    })
    await flushPromises()

    const cmContentEl = document.body.querySelector('.cm-content') as HTMLElement
    expect(cmContentEl).not.toBeNull()

    // Press 'i' to enter INSERT mode
    cmContentEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', bubbles: true }))
    await flushPromises()

    const modeBadge = document.body.querySelector('.mode-badge')
    expect(modeBadge?.textContent?.trim()).toBe('INSERT')

    // Press 'Escape' (test on window and element) to return to NORMAL mode
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(modeBadge?.textContent?.trim()).toBe('NORMAL')
    wrapper.unmount()
  })

  // Bug 3: ZZ shortcut and Ex commands :q, :q!, :wq should exit vim (emit close)
  it('[BUG 3a] shortcut ZZ exits vim when in normal mode', async () => {
    const wrapper = mount(VimEditor, {
      props: {
        slug: 'ark',
        filename: 'ark.md',
        initialContent: 'Hello world',
        role: 'root',
        isNvim: false
      },
      attachTo: document.body
    })
    await flushPromises()

    const cmContentEl = document.body.querySelector('.cm-content') as HTMLElement
    expect(cmContentEl).not.toBeNull()

    // Press 'Z' then 'Z' (Shift+ZZ)
    cmContentEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', bubbles: true }))
    await flushPromises()
    cmContentEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', bubbles: true }))
    await flushPromises()

    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })

  it('[BUG 3b] Ex command :q exits vim', async () => {
    const wrapper = mount(VimEditor, {
      props: {
        slug: 'ark',
        filename: 'ark.md',
        initialContent: 'Hello world',
        role: 'root',
        isNvim: false
      },
      attachTo: document.body
    })
    await flushPromises()

    const cmContentEl = document.body.querySelector('.cm-content') as HTMLElement
    expect(cmContentEl).not.toBeNull()

    // Press ':'
    cmContentEl.dispatchEvent(new KeyboardEvent('keydown', { key: ':', bubbles: true }))
    await flushPromises()

    const panelInput = document.body.querySelector('.cm-panels input') as HTMLInputElement
    expect(panelInput).not.toBeNull()
    panelInput.value = 'q'
    panelInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }))
    await flushPromises()

    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })

  it('[BUG 3c] Ex command :q! force exits vim even if modified', async () => {
    const wrapper = mount(VimEditor, {
      props: {
        slug: 'ark',
        filename: 'ark.md',
        initialContent: 'Hello world',
        role: 'root',
        isNvim: false
      },
      attachTo: document.body
    })
    await flushPromises()

    const cmContentEl = document.body.querySelector('.cm-content') as HTMLElement
    // Enter insert mode, add text
    cmContentEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', bubbles: true }))
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    // Press ':'
    cmContentEl.dispatchEvent(new KeyboardEvent('keydown', { key: ':', bubbles: true }))
    await flushPromises()

    const panelInput = document.body.querySelector('.cm-panels input') as HTMLInputElement
    expect(panelInput).not.toBeNull()
    panelInput.value = 'q!'
    panelInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }))
    await flushPromises()

    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })

  it('[BUG 3d] Ex command :wq saves and exits vim', async () => {
    const wrapper = mount(VimEditor, {
      props: {
        slug: 'ark',
        filename: 'ark.md',
        initialContent: 'Hello world',
        role: 'root',
        isNvim: false
      },
      attachTo: document.body
    })
    await flushPromises()

    const cmContentEl = document.body.querySelector('.cm-content') as HTMLElement
    // Press ':'
    cmContentEl.dispatchEvent(new KeyboardEvent('keydown', { key: ':', bubbles: true }))
    await flushPromises()

    const panelInput = document.body.querySelector('.cm-panels input') as HTMLInputElement
    expect(panelInput).not.toBeNull()
    panelInput.value = 'wq'
    panelInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }))
    await flushPromises()

    expect(wrapper.emitted('save')).toBeTruthy()
    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })
})
