import { Command, InvalidArgumentError } from 'commander';
import { EXIT_CODES } from '../core/domain.js';
import { findPreset, PRESETS } from '../core/presets.js';
import { parseTarget } from '../core/validate.js';
import { runHeadless } from './headless.js';
import { runPlain } from './plain.js';
import { runApp } from '../ui/app.js';
import { pickTargetInteractively } from '../ui/menu.js';

export interface RunConfig {
  target: string;
  requests: number;
  timeoutMs: number;
}

function parseRequests(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 1000) {
    throw new InvalidArgumentError('request count must be an integer from 1 to 1000');
  }
  return n;
}

function parseTimeout(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new InvalidArgumentError('timeout must be a non-negative number of seconds');
  }
  return n;
}

interface Options {
  requests: number;
  timeout: number;
  preset?: string;
  json?: boolean;
}

const program = new Command();

program
  .name('netspeed')
  .description('Measure HTTP download speed: N sequential requests, per-phase timings, live TUI.')
  .version('1.0.0')
  .argument('[url]', 'target URL to download; omit for the interactive menu')
  .option(
    '-n, --requests <count>',
    'number of sequential requests (assignment default: 10)',
    parseRequests,
    10,
  )
  .option(
    '-t, --timeout <seconds>',
    'per-probe time limit in seconds (0 = wait for the full response — the default)',
    parseTimeout,
    0,
  )
  .option('-p, --preset <id>', `built-in target preset (${PRESETS.map((p) => p.id).join(' | ')})`)
  .option('--json', 'machine-readable JSON output (no TUI)')
  .action(async (urlArg: string | undefined, options: Options) => {
    await run(urlArg, options);
  });

async function run(urlArg: string | undefined, options: Options): Promise<void> {
  const preset = options.preset ? findPreset(options.preset) : undefined;

  if (options.preset && !preset) {
    console.error(
      `✗ Unknown preset "${options.preset}". Available: ${PRESETS.map((p) => p.id).join(', ')}`,
    );
    process.exitCode = EXIT_CODES.usage;
    return;
  }
  if (urlArg && preset) {
    console.error('✗ Pass either a URL or --preset, not both.');
    process.exitCode = EXIT_CODES.usage;
    return;
  }

  let url = urlArg ?? preset?.url;

  if (url === undefined) {
    if (options.json) {
      console.error('✗ --json requires a URL argument or --preset.');
      process.exitCode = EXIT_CODES.usage;
      return;
    }
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      console.error('✗ The interactive menu needs a real terminal. Pass a URL or use --preset.');
      process.exitCode = EXIT_CODES.usage;
      return;
    }
    const picked = await pickTargetInteractively();
    if (picked === null) {
      process.exitCode = EXIT_CODES.usage;
      return;
    }
    url = picked;
  }

  const parsed = parseTarget(url);
  if (!parsed.ok) {
    console.error(`✗ ${parsed.error}`);
    process.exitCode = EXIT_CODES.usage;
    return;
  }

  const config: RunConfig = {
    target: parsed.url,
    requests: options.requests,
    timeoutMs: Math.round(options.timeout * 1000),
  };

  if (options.json) {
    await runHeadless(config);
  } else if (process.stdout.isTTY && process.stdin.isTTY) {
    // Live TUI needs both: stdin for keys, stdout for the redraw loop.
    await runApp(config);
  } else {
    await runPlain(config);
  }
}

await program.parseAsync(process.argv);
