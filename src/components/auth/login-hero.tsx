import { BudgetDemo } from '#/components/auth/budget-demo'

const FEATURES = [
  {
    title: 'Plan with money you have',
    body: 'Assign what’s in your accounts today, not what you hope to earn.',
  },
  {
    title: 'Set targets',
    body: 'Save for yearly bills a little each month and see what’s still needed.',
  },
  {
    title: 'Bring in your bank file',
    body: 'Import CSV, OFX or QFX. Duplicates are skipped for you.',
  },
  {
    title: 'Budget together',
    body: 'Share a budget and choose who can edit and who can only look.',
  },
]

/** The pitch half of the home and login pages. */
export function LoginHero() {
  return (
    <div className="bg-hero text-hero-foreground relative isolate flex flex-col justify-center gap-10 overflow-hidden px-6 py-12 sm:px-10 lg:min-h-dvh lg:px-14 xl:px-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_85%_15%,var(--hero-glow),transparent_70%)] opacity-70"
      />
      {/* 간소 is Korean for "simplicity"; here it is set vertically as background type. */}
      <div
        lang="ko"
        aria-hidden
        className="text-hero-foreground/10 pointer-events-none absolute inset-y-0 right-4 -z-10 hidden flex-col justify-center text-[min(38dvh,20vw)] leading-none font-black select-none xl:flex"
      >
        <span>간</span>
        <span>소</span>
      </div>

      <div className="flex max-w-xl flex-col gap-4">
        <h2 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl xl:text-6xl">
          Budgeting, simplified.
        </h2>
        <p className="text-hero-muted max-w-md text-base text-pretty sm:text-lg">
          <em className="text-hero-foreground not-italic">Ganso</em> is Korean
          for simplicity. Give every dollar a job before you spend it, and
          always know what’s left.
        </p>
      </div>

      <BudgetDemo />

      <ul className="grid max-w-xl gap-x-8 gap-y-5 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">{f.title}</h3>
            <p className="text-hero-muted text-sm text-pretty">{f.body}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
