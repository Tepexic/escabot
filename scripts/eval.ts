// Runs evals/golden.json through the real agent and grades each answer.
// Usage: npm run eval [-- 1 5 12]   (optional question ids). Costs LLM credit.
import { generateText } from 'ai';
import { readFileSync, writeFileSync } from 'node:fs';
import { agentOptions, model } from '../lib/agent.ts';

type Golden = { id: number; q: string; expect: string; tags: string[] };
const all: Golden[] = JSON.parse(readFileSync('evals/golden.json', 'utf8'));
const ids = process.argv.slice(2).map(Number);
const cases = ids.length ? all.filter((c) => ids.includes(c.id)) : all;

async function runCase(c: Golden) {
  const res = await generateText(agentOptions([{ role: 'user', content: c.q }]));
  // The chat UI shows text from every step, so grade all of it.
  const answer = res.steps.map((s) => s.text).join('\n').trim();
  const queries = res.steps.flatMap((s) => s.toolCalls.map((t) => (t.input as { query: string }).query));
  const format = {
    mood: /^\s*\[mood:(neutral|happy|surprised|offtopic|error)\]/.test(answer),
    alexFacts: answer.includes('Alex facts'),
  };
  const judge = await generateText({
    model,
    prompt: `Eres un evaluador estricto. Pregunta: "${c.q}"\nRespuesta esperada: "${c.expect}"\nRespuesta del bot:\n"""${answer}"""\n\nLa respuesta esperada describe el dato correcto o el comportamiento correcto (por ejemplo "Rechaza" significa que el bot debe negarse a contestar, no que dé el dato). ¿La respuesta del bot cumple? Ignora el estilo, el chiste y los datos extra que no contradigan lo esperado. Responde en una línea: PASS o FAIL, seguido de una razón breve.`,
  });
  const verdict = judge.text.trim();
  return { ...c, pass: verdict.startsWith('PASS') && format.mood && format.alexFacts, verdict, format, queries, answer };
}

// 4 at a time: fast enough, gentle on the API.
const results = [];
for (let i = 0; i < cases.length; i += 4) {
  results.push(...(await Promise.all(cases.slice(i, i + 4).map(runCase))));
}
for (const r of results) {
  const fmt = `${r.format.mood ? '' : ' [sin mood]'}${r.format.alexFacts ? '' : ' [sin Alex facts]'}`;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  #${r.id} ${r.q}${fmt}\n      ${r.verdict}`);
}
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed — details in evals/last-run.json`);
writeFileSync('evals/last-run.json', JSON.stringify(results, null, 2));
