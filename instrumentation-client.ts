import { initBotId } from 'botid/client/core';

// Invisible bot check (Vercel BotID, Basic mode) on the only endpoint that spends money.
initBotId({ protect: [{ path: '/api/chat', method: 'POST' }] });
