import { useState, useRef, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface EmailRecipientInputProps {
  recipients: string[]
  onChange: (recipients: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

// Simple email validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function EmailRecipientInput({
  recipients,
  onChange,
  placeholder = 'Enter email and press Enter',
  disabled = false,
  className,
}: EmailRecipientInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addRecipient = (email: string) => {
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedEmail) return

    if (!isValidEmail(trimmedEmail)) {
      setError('Invalid email format')
      return
    }

    if (recipients.includes(trimmedEmail)) {
      setError('Email already added')
      return
    }

    onChange([...recipients, trimmedEmail])
    setInputValue('')
    setError(null)
  }

  const removeRecipient = (email: string) => {
    onChange(recipients.filter((r) => r !== email))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addRecipient(inputValue)
    } else if (e.key === 'Backspace' && inputValue === '' && recipients.length > 0) {
      // Remove last recipient when backspace is pressed with empty input
      removeRecipient(recipients[recipients.length - 1])
    }
  }

  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        onClick={handleContainerClick}
        className={cn(
          'flex flex-wrap gap-1.5 rounded-md border bg-background px-3 py-2 min-h-[42px] cursor-text',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-destructive'
        )}
      >
        {recipients.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-sm text-primary"
          >
            {email}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeRecipient(email)
                }}
                className="rounded-full p-0.5 hover:bg-primary/20"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        <Input
          ref={inputRef}
          type="email"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder={recipients.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[200px] border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
