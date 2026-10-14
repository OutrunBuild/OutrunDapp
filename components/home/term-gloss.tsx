import type { ReactNode } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type TermGlossEntry = {
  term: string
  title: string
  description: string
}

function GlossTerm({ gloss }: { gloss: TermGlossEntry }) {
  return (
    <Tooltip>
      <TooltipTrigger className="term-gloss">{gloss.term}</TooltipTrigger>
      <TooltipContent>
        <span className="term-gloss__tip">
          <b>{gloss.title}</b>
          <span>{gloss.description}</span>
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

/** Term glosses at reuse sites: splits the string by the glossary and attaches hover bubbles at
 *  hits; first-occurrence definitions stay in the mechanism section body and are not repeated here */
export function TermGlossText({
  text,
  glosses,
}: {
  text: string
  glosses: readonly TermGlossEntry[]
}) {
  if (glosses.length === 0) {
    return text
  }
  const escaped = glosses.map((gloss) => gloss.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'g'))
  return parts.map((part, index): ReactNode => {
    const gloss = glosses.find((entry) => entry.term === part)
    return gloss ? <GlossTerm key={index} gloss={gloss} /> : part
  })
}
