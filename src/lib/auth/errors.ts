export function getAuthErrorMessage(message: string): string {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('invalid login credentials')) {
    return 'Incorrect email or password'
  }
  
  if (lowerMessage.includes('user already registered')) {
    return 'An account with this email already exists'
  }
  
  if (lowerMessage.includes('email not confirmed')) {
    return 'Please check your email and confirm your account first'
  }

  // Generic fallback if not matched
  return message || 'An unexpected error occurred. Please try again.'
}
