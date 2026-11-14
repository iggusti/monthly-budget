/**
 * Emphasis markers for translation strings.
 *
 * Some i18n text needs a few figures to stand out (the month page's conclusion
 * note). Rather than injecting HTML, strings carry `**…**` around those runs and
 * the markup renders the split parts as real `<strong>` elements — so the text
 * stays escaped and the component's CSS scope keeps working.
 */

/** One run of a paragraph: `strong` marks text that was wrapped in `**`. */
export interface EmphasisRun {
  text: string;
  strong: boolean;
}

/**
 * Split a string on `**…**` spans.
 *
 * An unclosed marker is left as literal text, so a typo in a translation
 * degrades to plain text instead of swallowing the rest of the sentence.
 */
export function splitEmphasis(input: string): EmphasisRun[] {
  const runs: EmphasisRun[] = [];
  const pattern = /\*\*([\s\S]+?)\*\*/g;
  let cursor = 0;

  for (let match = pattern.exec(input); match; match = pattern.exec(input)) {
    if (match.index > cursor) {
      runs.push({ text: input.slice(cursor, match.index), strong: false });
    }
    runs.push({ text: match[1], strong: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < input.length) runs.push({ text: input.slice(cursor), strong: false });

  return runs;
}
