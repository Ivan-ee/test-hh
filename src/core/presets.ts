/** Built-in targets for the interactive menu and `--preset`. */

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly url: string;
}

/**
 * Both URLs were verified live on 2026-11-17 (research ticket #3):
 * 200, no auth, no redirects, stable hosts.
 */
export const PRESETS: readonly Preset[] = [
  {
    id: 'yandex-image',
    label: 'Yandex image',
    hint: 'JPEG, ~3.5 MB — avatars.mds.yandex.net',
    url: 'https://avatars.mds.yandex.net/get-altay/15394162/2a0000019aa54049803be5726e377eb64726/orig',
  },
  {
    id: 'sintel-video',
    label: 'Sintel movie (Blender)',
    hint: 'MKV, ~1.1 GB — download.blender.org',
    url: 'https://download.blender.org/durian/movies/Sintel.2010.1080p.mkv',
  },
];

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
