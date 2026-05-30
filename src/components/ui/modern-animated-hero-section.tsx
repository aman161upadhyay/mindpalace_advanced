import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────
interface Character {
  char: string
  x: number
  y: number
  speed: number
}

// ── TextScramble engine ───────────────────────────────────────────────────────
class TextScramble {
  el: HTMLElement
  chars: string
  queue: Array<{
    from: string
    to: string
    start: number
    end: number
    char?: string
  }>
  frame: number
  frameRequest: number
  resolve: (value: void | PromiseLike<void>) => void

  constructor(el: HTMLElement) {
    this.el = el
    this.chars = "!<>-_\\/[]{}—=+*^?#"
    this.queue = []
    this.frame = 0
    this.frameRequest = 0
    this.resolve = () => {}
    this.update = this.update.bind(this)
  }

  setText(newText: string) {
    const oldText = this.el.innerText
    const length = Math.max(oldText.length, newText.length)
    const promise = new Promise<void>((resolve) => {
      this.resolve = resolve
    })
    this.queue = []
    for (let i = 0; i < length; i++) {
      const from = oldText[i] || ""
      const to = newText[i] || ""
      const start = Math.floor(Math.random() * 40)
      const end = start + Math.floor(Math.random() * 40)
      this.queue.push({ from, to, start, end })
    }
    cancelAnimationFrame(this.frameRequest)
    this.frame = 0
    this.update()
    return promise
  }

  update() {
    let output = ""
    let complete = 0
    for (let i = 0, n = this.queue.length; i < n; i++) {
      // eslint-disable-next-line prefer-const
      let { from, to, start, end, char } = this.queue[i]
      if (this.frame >= end) {
        complete++
        output += to
      } else if (this.frame >= start) {
        if (!char || Math.random() < 0.28) {
          char = this.chars[Math.floor(Math.random() * this.chars.length)]
          this.queue[i].char = char
        }
        output += `<span class="dud">${char}</span>`
      } else {
        output += from
      }
    }
    this.el.innerHTML = output
    if (complete === this.queue.length) {
      this.resolve()
    } else {
      this.frameRequest = requestAnimationFrame(this.update)
      this.frame++
    }
  }
}

// ── ScrambledOnce ─────────────────────────────────────────────────────────────
// Scrambles text in once from blank, then holds static. No cursors.
export const ScrambledOnce: React.FC<{ text: string }> = ({ text }) => {
  const elementRef = useRef<HTMLSpanElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (elementRef.current) setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !elementRef.current) return
    const scrambler = new TextScramble(elementRef.current)
    // Brief delay so the rain background is visually ready before the title appears
    const id = setTimeout(() => {
      scrambler.setText(text)
    }, 180)
    return () => {
      clearTimeout(id)
      cancelAnimationFrame(scrambler.frameRequest)
    }
  }, [mounted, text])

  return (
    <span
      ref={elementRef}
      className="font-bold tracking-wider text-foreground"
      style={{
        fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: "clamp(2rem, 4.5vw, 3.6rem)",
        lineHeight: 1.15,
        minWidth: "10ch",
        display: "inline-block",
        textAlign: "center",
      }}
    />
  )
}

// ── ScrambledCycling ──────────────────────────────────────────────────────────
// Cycles endlessly through an array of phrases using the scramble effect.
export const ScrambledCycling: React.FC<{
  phrases: string[]
  className?: string
  holdMs?: number
}> = ({ phrases, className, holdMs = 1800 }) => {
  const elementRef = useRef<HTMLSpanElement>(null)
  const scramblerRef = useRef<TextScramble | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (elementRef.current && !scramblerRef.current) {
      scramblerRef.current = new TextScramble(elementRef.current)
      setMounted(true)
    }
  }, [])

  useEffect(() => {
    if (!mounted || !scramblerRef.current) return
    let counter = 0
    let timeoutId: ReturnType<typeof setTimeout>
    const next = () => {
      if (scramblerRef.current) {
        scramblerRef.current.setText(phrases[counter]).then(() => {
          timeoutId = setTimeout(next, holdMs)
        })
        counter = (counter + 1) % phrases.length
      }
    }
    next()
    return () => clearTimeout(timeoutId)
  }, [mounted, phrases, holdMs])

  return (
    <span
      ref={elementRef}
      className={className ?? ""}
      style={{ fontFamily: '"JetBrains Mono", monospace' }}
    >
      {phrases[0]}
    </span>
  )
}

// ── Character rain constants ───────────────────────────────────────────────────
// Latin A-Z, Greek uppercase + lowercase, digits
const CHAR_SET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω" +
  "0123456789"
const CHAR_COUNT = 220

// ── RainingLettersBackground ──────────────────────────────────────────────────
export const RainingLettersBackground: React.FC = () => {
  const [characters, setCharacters] = useState<Character[]>([])
  const [activeIndices, setActiveIndices] = useState<Set<number>>(new Set())

  const createCharacters = useCallback((): Character[] => {
    const chars: Character[] = []
    for (let i = 0; i < CHAR_COUNT; i++) {
      chars.push({
        char: CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)],
        x: Math.random() * 100,
        y: Math.random() * 100,
        speed: 0.06 + Math.random() * 0.20,
      })
    }
    return chars
  }, [])

  useEffect(() => {
    setCharacters(createCharacters())
  }, [createCharacters])

  useEffect(() => {
    const id = setInterval(() => {
      const next = new Set<number>()
      const count = Math.floor(Math.random() * 3) + 2
      for (let i = 0; i < count; i++) {
        next.add(Math.floor(Math.random() * CHAR_COUNT))
      }
      setActiveIndices(next)
    }, 55)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let rafId: number
    const tick = () => {
      setCharacters((prev) =>
        prev.map((c) =>
          c.y >= 100
            ? {
                ...c,
                y: -5,
                x: Math.random() * 100,
                char: CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)],
              }
            : { ...c, y: c.y + c.speed }
        )
      )
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div
      className="overflow-hidden pointer-events-none select-none"
      style={{ position: "fixed", inset: 0, zIndex: -1 }}
    >
      {characters.map((char, index) => {
        const isActive = activeIndices.has(index)
        return (
          <span
            key={index}
            className="absolute"
            style={{
              left: `${char.x}%`,
              top: `${char.y}%`,
              transform: "translate(-50%, -50%)",
              color: isActive ? "#7aaa88" : "rgba(78, 106, 87, 0.18)",
              textShadow: isActive
                ? "0 0 8px rgba(100,132,111,0.9), 0 0 18px rgba(78,106,87,0.5)"
                : "none",
              fontSize: "1.35rem",
              fontFamily: '"JetBrains Mono", monospace',
              transition: "color 0.1s, text-shadow 0.1s",
              willChange: "top",
              lineHeight: 1,
            }}
          >
            {char.char}
          </span>
        )
      })}
    </div>
  )
}

// ── Standalone demo ───────────────────────────────────────────────────────────
const RainingLetters: React.FC = () => {
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
        <ScrambledOnce text="Mind Palace" />
      </div>
      <RainingLettersBackground />
    </div>
  )
}

export default RainingLetters
