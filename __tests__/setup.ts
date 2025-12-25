import '@testing-library/jest-dom'
import { vi } from 'vitest'

const createMatchMedia = (matches: boolean) => ({
  matches,
  media: '',
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => createMatchMedia(false)),
})

Object.defineProperty(window, 'innerWidth', {
  writable: true,
  value: 1024,
})
