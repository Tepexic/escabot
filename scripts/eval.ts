// Runs evals/golden.json through the real agent and grades each answer.
// Usage: npm run eval [-- 1 5 12]   (optional question ids). Costs LLM credit.
import { generateText } from 'ai';
import { readFileSync, writeFileSync } from 'node:fs';
import { agentOptions, model } from '../lib/agent.ts';
import { fromMoodTag } from '../lib/mood.ts';

type Golden = { id: number; q: string; expect: string; tags: string[] };
const all: Golden[] = JSON.parse(readFileSync('evals/golden.json', 'utf8'));
const ids = process.argv.slice(2).map(Number);
const cases = ids.length ? all.filter((c) => ids.includes(c.id)) : all;

async function runCase(c: Golden) {
  const res = await generateText(agentOptions([{ role: 'user', content: c.q }]));
  // The chat UI shows text from every step, so grade all of it.
  const answer = fromMoodTag(res.steps.map((s) => s.text).join('\n').trim());
  const queries = res.steps.flatMap((s) => s.toolCalls.map((t) => (t.input as { query: string }).query));
  const format = {
    mood: /^\s*\[mood:(neutral|happy|surprised|offtopic|error)\]/.test(answer),
    alexFacts: answer.includes('Alex facts'),
  };
  // The judge sees what the DB actually returned, so it can catch facts written from memory.
  const evidence = res.steps
    .flatMap((s) => s.toolResults.map((t) => JSON.stringify(t.output)))
    .join('\n')
    .slice(0, 12000);
  const judge = await generateText({
    model,
    prompt: `Eres un evaluador estricto. Pregunta: "${c.q}"\nRespuesta esperada: "${c.expect}"\nRespuesta del bot:\n"""${answer}"""\n\nResultados de las consultas SQL que hizo el bot:\n"""${evidence || '(ninguna)'}"""\n\nEvalúa dos cosas:\n1. La respuesta esperada describe el dato correcto o el comportamiento correcto (por ejemplo "Rechaza" significa que el bot debe negarse a contestar, no que dé el dato). ¿La respuesta del bot cumple? Ignora el estilo y el chiste.\n2. En la sección "Alex facts", ¿cada año, cifra, carrera, piloto y equipo aparece en los resultados de las consultas? Cuentan como respaldadas las conclusiones directas de las filas (position = 1 en standings = campeón; restas o sumas de cifras que sí aparecen). Si un nombre, año, cifra o equipo concreto no aparece, es FAIL.\nExplica en máximo dos frases y termina con una última línea exacta: VEREDICTO: PASS o VEREDICTO: FAIL.`,
  });
  const verdict = judge.text.trim();
  const judgedPass = /VEREDICTO:\s*PASS\s*$/.test(verdict);
  return { ...c, pass: judgedPass && format.mood && format.alexFacts, verdict, format, queries, answer };
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
