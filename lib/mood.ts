// The answer starts at the [mood:…] tag. Anything before it is chatter the model sometimes
// writes before its queries ("I'll check the database."), so drop it. Shared by UI and eval.
export const fromMoodTag = (text: string) => {
  const i = text.indexOf('[mood:');
  return i > 0 ? text.slice(i) : text;
};
