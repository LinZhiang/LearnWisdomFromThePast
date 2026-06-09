const GUIDE_WELCOME_KEY = 'wengu-guide-welcome-seen-v1'

export function hasSeenGuideWelcome(): boolean {
  try {
    return window.localStorage.getItem(GUIDE_WELCOME_KEY) === '1'
  } catch {
    return false
  }
}

export function markGuideWelcomeSeen(): void {
  try {
    window.localStorage.setItem(GUIDE_WELCOME_KEY, '1')
  } catch {
    /* ignore */
  }
}
