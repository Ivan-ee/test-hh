const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

/** Unicode sparkline of the most recent instant-speed samples. */
export function sparkline(values: readonly number[], width = 24): string {
  const recent = values.slice(-width);
  if (recent.length === 0) return '';
  const max = Math.max(...recent, 1);
  return recent
    .map((value) => {
      const level = Math.min(BLOCKS.length - 1, Math.floor((value / max) * (BLOCKS.length - 1)));
      return BLOCKS[level] ?? '▁';
    })
    .join('');
}
