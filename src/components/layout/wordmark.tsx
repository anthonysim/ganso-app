import { cn } from '#/lib/utils'

/** The ganso wordmark. 간소 is Korean for "simplicity". */
export function Wordmark({
  size = 'sm',
  korean = true,
  className,
}: {
  size?: 'sm' | 'lg'
  /** Show 간소 next to the wordmark (on by default). */
  korean?: boolean
  className?: string
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        className={cn(
          'font-semibold tracking-tight text-primary lowercase dark:text-inherit',
          size === 'sm' ? 'text-lg' : 'text-5xl',
          className,
        )}
      >
        ganso
      </span>
      {korean ? (
        <span
          lang="ko"
          aria-hidden
          className={cn(
            'text-muted-foreground font-medium',
            size === 'sm' ? 'hidden text-sm sm:inline' : 'text-2xl',
          )}
        >
          간소
        </span>
      ) : null}
    </span>
  )
}
