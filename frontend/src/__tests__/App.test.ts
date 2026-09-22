import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import App from '../App.vue'

describe('Walking Skeleton', () => {
  it('renders Terminal and can execute commands', async () => {
    const wrapper = mount(App)
    const terminal = wrapper.find('.terminal')
    expect(terminal.exists()).toBe(true)

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)

    // Test help command
    await input.setValue('help')
    await input.trigger('keydown', { key: 'Enter' })
    
    expect(wrapper.text()).toContain('Available commands: help, ls, open <slug>, cat <slug>, clear')

    // Test ls command
    await input.setValue('ls')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.text()).toContain('ark  articles  about')
    
    // Test clear command
    await input.setValue('clear')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.text()).not.toContain('ark  articles  about')
  })

  it('opens WindowCard and closes it', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    
    // WindowCard should not exist initially
    expect(wrapper.find('.window-pane').exists()).toBe(false)

    const input = wrapper.find('input')
    await input.setValue('open ark')
    await input.trigger('keydown', { key: 'Enter' })

    // WindowCard should appear
    const windowPane = wrapper.find('.window-pane')
    expect(windowPane.exists()).toBe(true)
    
    // Contains title and content
    expect(wrapper.text()).toContain('|_ark.exe')
    expect(wrapper.text()).toContain('这是一艘飞船。')

    // Click to close
    const closeBtn = wrapper.find('.controls')
    await closeBtn.trigger('click')

    // WindowCard should disappear
    expect(wrapper.find('.window-pane').exists()).toBe(false)
    
    // Open again using cat
    await input.setValue('cat articles')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.find('.window-pane').exists()).toBe(true)
    expect(wrapper.text()).toContain('|_articles.exe')
    
    // Close using Escape key
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
    window.dispatchEvent(escapeEvent)
    
    // wait for vue to process event
    await wrapper.vm.$nextTick()
    
    expect(wrapper.find('.window-pane').exists()).toBe(false)
    
    wrapper.unmount()
  })
})
