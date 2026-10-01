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

/** 复用处术语释义：按术语表切分字符串、命中处挂悬停气泡；首现定义仍在机制段正文，不在此重复 */
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
