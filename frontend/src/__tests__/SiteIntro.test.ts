import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import SiteIntro from '../components/SiteIntro.vue'

describe('SiteIntro Component', () => {
  it('renders author name and email link', () => {
    const wrapper = mount(SiteIntro)
    expect(wrapper.text()).toContain('梁晨')
    expect(wrapper.text()).toContain('liangchen0920@gmail.com')

    const mailto = wrapper.find('a[href="mailto:liangchen0920@gmail.com"]')
    expect(mailto.exists()).toBe(true)
  })

  it('renders Option A ASCII banner and role description when expanded by default', () => {
    const wrapper = mount(SiteIntro)
    
    // Check ASCII banner
    const banner = wrapper.find('.ascii-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('| |    ___  _ __')
    expect(banner.text()).toContain('LONG4CHANGES')

    // Check identity role
    expect(wrapper.text()).toContain('Independent Developer / Vibe Coding Enthusiast')
    // Check hint
    expect(wrapper.text()).toContain("Type 'help', 'ls', or 'open hello-world'")
  })

  it('supports toggle collapse and expand', async () => {
    const wrapper = mount(SiteIntro)
    const toggleBtn = wrapper.find('.toggle-btn')
    expect(toggleBtn.exists()).toBe(true)
    expect(toggleBtn.text()).toContain('HIDE')

    // Click to collapse
    await toggleBtn.trigger('click')

    // Banner should be hidden
    expect(wrapper.find('.ascii-banner').exists()).toBe(false)
    expect(toggleBtn.text()).toContain('EXPAND')

    // Compact summary still shows name and role
    expect(wrapper.text()).toContain('梁晨')
    expect(wrapper.text()).toContain('Independent Developer')

    // Click to expand again
    await toggleBtn.trigger('click')
    expect(wrapper.find('.ascii-banner').exists()).toBe(true)
    expect(toggleBtn.text()).toContain('HIDE')
  })
})
