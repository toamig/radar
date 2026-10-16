// Where the project lives. The tune links open issues in this repo.
export const REPO = 'toamig/radar';
export const REPO_URL = `https://github.com/${REPO}`;

const LANES = { gamedev: 'Game dev', ai: 'Software and AI', both: 'Games and software' } as const;
export const laneName = (lane: keyof typeof LANES) => LANES[lane];

/** A prefilled GitHub issue that the feedback workflow folds into editorial/feedback.md. */
export function tuneUrl(dir: 'more' | 'less', date: string, block: { id: string; title: string; format: string; lane: string }) {
  const title = `${dir === 'more' ? 'More like' : 'Less like'}: ${block.title}`.slice(0, 120);
  const body = [
    `direction: ${dir}`,
    `issue: ${date}`,
    `block: ${block.id}`,
    `format: ${block.format}`,
    `lane: ${block.lane}`,
    '',
    'Optional note (what exactly, and why):',
    '',
  ].join('\n');
  const q = new URLSearchParams({ title, body, labels: 'feedback' });
  return `${REPO_URL}/issues/new?${q}`;
}
