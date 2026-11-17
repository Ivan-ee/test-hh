import { Box, Text } from 'ink';
import type { RunResult } from '../core/domain.js';
import { formatBytes, formatDuration, formatMbps, formatRate } from '../core/format.js';

/** Final run summary — pushed into the static zone, so it survives exit. */
export function Summary({ result }: { result: RunResult }) {
  const stats = result.stats;
  const healthy = stats.successful > 0;

  return (
    <Box
      borderStyle="round"
      borderColor={healthy ? 'green' : 'red'}
      flexDirection="column"
      paddingX={1}
      marginTop={1}
    >
      <Text bold color="cyan">
        Summary
      </Text>
      <Text>
        Downloaded <Text bold>{formatBytes(result.totalBytes)}</Text> in {result.requests} requests
        {stats.failed > 0 ? <Text color="yellow"> ({stats.failed} failed)</Text> : null}
      </Text>
      <Text>
        Speed{' '}
        <Text bold color={healthy ? 'green' : 'red'}>
          {result.runSpeedBps === null ? '—' : formatRate(result.runSpeedBps)}
        </Text>
        {result.runSpeedBps !== null ? (
          <Text dimColor> ({formatMbps(result.runSpeedBps)})</Text>
        ) : null}
      </Text>
      <Text>
        Request time avg {formatDuration(stats.avgMs)} · median {formatDuration(stats.medianMs)} ·
        min {formatDuration(stats.minMs)} · max {formatDuration(stats.maxMs)}
      </Text>
      {result.contentType !== null && (
        <Text dimColor>
          Content: {result.contentType}
          {result.contentLength !== null ? ` · ${formatBytes(result.contentLength)} declared` : ''}
        </Text>
      )}
    </Box>
  );
}
