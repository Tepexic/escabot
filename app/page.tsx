'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fromMoodTag } from '../lib/mood.ts';
import { Escabot, type Mood } from './Escabot';

const STORAGE_KEY = 'escabot-chat';
const MAX_CHARS = 1000;
const EXAMPLES = [
  '¿Cuántas victorias tiene Checo?',
  '¿Quién ganó el GP de México 2015?',
  '¿Quién tiene más poles en la historia?',
  '¿Cuántas veces ganó Senna en Mónaco?',
];
const MOODS = ['neutral', 'happy', 'surprised', 'offtopic', 'error'];

const MOOD_TAG = /^\s*\[mood:(\w+)\]\s*/;
const moodOf = (text: string): Mood => {
  const m = text.match(MOOD_TAG)?.[1];
  return m && MOODS.includes(m) ? (m as Mood) : 'neutral';
};

const textOf = (m: UIMessage) =>
  m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
const queriesOf = (m: UIMessage) =>
  m.parts.flatMap((p) =>
    p.type === 'tool-run_sql' && p.input ? [(p.input as { query: string }).query] : [],
  );

// The answer's closing "🪜 Alex facts" paragraph gets the yellow comic box.
const startsWithLadder = (children: ReactNode) => {
  const first = Array.isArray(children) ? children[0] : children;
  return typeof first === 'string' && first.startsWith('🪜');
};
const markdown = {
  a: (props: React.ComponentProps<'a'>) => <a {...props} target="_blank" rel="noreferrer" />,
  table: (props: React.ComponentProps<'table'>) => (
    <div className="tbl">
      <table {...props} />
    </div>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className={startsWithLadder(children) ? 'facts' : undefined}>{children}</p>
  ),
};

const Bubble = ({ children }: { children: ReactNode }) => <div className="bubble">{children}</div>;

export default function Chat() {
  const { messages, sendMessage, status, error, setMessages, regenerate, stop } = useChat();
  const [input, setInput] = useState('');
  const loaded = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const info = useRef<HTMLDialogElement>(null);
  const busy = status === 'submitted' || status === 'streaming';

  // Chat lives only in this browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
    loaded.current = true;
  }, [setMessages]);
  useEffect(() => {
    if (!loaded.current || busy || messages.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages, busy]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status]);

  const ask = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput('');
  };
  const reset = () => {
    stop();
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const last = messages.at(-1);
  const waiting = busy && last?.role === 'user';
  const lastText = last?.role === 'assistant' ? fromMoodTag(textOf(last)) : '';
  // Escabot's mood follows the latest exchange.
  const mood: Mood = error ? 'error' : busy && !lastText ? 'thinking' : moodOf(lastText);

  return (
    <div className="app">
      <header className="top">
        <h1>ESCABOT</h1>
        <div className="actions">
          <button type="button" className="ghost icon" aria-label="Acerca de Escabot" onClick={() => info.current?.showModal()}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 11v6M12 7.5v.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
          {messages.length > 0 && (
            <button type="button" className="ghost" onClick={reset}>
              Nueva conversación
            </button>
          )}
        </div>
      </header>

      <dialog
        ref={info}
        className="info"
        aria-labelledby="info-title"
        onClick={(e) => e.target === info.current && info.current.close()}
      >
        <h2 id="info-title">Acerca de Escabot</h2>
        <p>
          Homenaje de fans, no oficial ni afiliado a{' '}
          <a href="https://www.tiktok.com/@escaleraf1" target="_blank" rel="noreferrer">Alex Escalera</a>.
        </p>
        <p>
          Datos: <a href="https://github.com/jolpica/jolpica-f1" target="_blank" rel="noreferrer">Jolpica-F1</a>{' '}
          (CC BY-NC-SA 4.0), temporadas 1950 a 2025.
        </p>
        <form method="dialog">
          <button className="ghost">Cerrar</button>
        </form>
      </dialog>

      <main className="chat" aria-live="polite">
        {messages.length === 0 && (
          <section className="welcome">
            <Escabot mood="happy" className="hero" />
            <p className="hello">
              ¡Qué onda! Soy Escabot. Pregúntame lo que quieras de Fórmula 1, de 1950 a 2025, y te lo cuento con datos.
            </p>
            <div className="examples">
              {EXAMPLES.map((q) => (
                <button key={q} type="button" onClick={() => ask(q)}>
                  {q}
                </button>
              ))}
            </div>
          </section>
        )}

        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="msg-user">
                {textOf(m)}
              </div>
            );
          }
          const text = fromMoodTag(textOf(m));
          const live = m === last && busy;
          const queries = queriesOf(m);
          return (
            <Bubble key={m.id}>
              {text ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdown}>
                  {text.replace(MOOD_TAG, '')}
                </ReactMarkdown>
              ) : (
                <p className="muted">Déjame subirme a revisar…</p>
              )}
              {queries.length > 0 && !live && (
                <details>
                  <summary>¿Cómo lo calculé?</summary>
                  {queries.map((q, i) => (
                    <code key={i}>{q}</code>
                  ))}
                </details>
              )}
            </Bubble>
          );
        })}

        {waiting && (
          <Bubble>
            <p className="muted">Déjame subirme a revisar…</p>
          </Bubble>
        )}

        {error && (
          <Bubble>
            <p>No se me abrió el DRS, intenta en un rato.</p>
            <button type="button" className="ghost" onClick={() => regenerate()}>
              Reintentar
            </button>
          </Bubble>
        )}
        <div ref={end} />
      </main>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        {/* Docked above the input; the chat scrolls behind him through a frosted patch. */}
        {messages.length > 0 && (
          <div className="dock" aria-hidden="true">
            <Escabot mood={mood} />
            <div className="shadow" />
          </div>
        )}
        <label htmlFor="q" className="sr-only">
          Tu pregunta
        </label>
        <input
          id="q"
          value={input}
          maxLength={MAX_CHARS}
          autoComplete="off"
          placeholder="Pregúntale a Escabot…"
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
