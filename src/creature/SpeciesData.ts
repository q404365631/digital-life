import { Species } from '../types';

export interface SpeciesInfo {
  readonly name: string;
  readonly description: string;
  readonly baseColor: string;
  readonly highlightColor: string;
  readonly shadowColor: string;
  readonly eyeColor: string;
  readonly accentColor: string;
}

export const SPECIES_DATA: Record<Species, SpeciesInfo> = {
  puff: {
    name: 'Puff',
    description: 'Fluffy and shy',
    baseColor: '#FFB6C1',
    highlightColor: '#FFD1DC',
    shadowColor: '#E8909C',
    eyeColor: '#FFFFFF',
    accentColor: '#FFC0CB',
  },
  blob: {
    name: 'Blob',
    description: 'Slimy and chill',
    baseColor: '#87CEEB',
    highlightColor: '#B0E0E6',
    shadowColor: '#5F9EA0',
    eyeColor: '#FFFFFF',
    accentColor: '#ADD8E6',
  },
  pip: {
    name: 'Pip',
    description: 'Curious and quick',
    baseColor: '#FFD700',
    highlightColor: '#FFEC8B',
    shadowColor: '#DAA520',
    eyeColor: '#FFFFFF',
    accentColor: '#FFA500',
  },
  wisp: {
    name: 'Wisp',
    description: 'Mysterious and quiet',
    baseColor: '#DDA0DD',
    highlightColor: '#E6E6FA',
    shadowColor: '#9370DB',
    eyeColor: '#FFFFFF',
    accentColor: '#D8BFD8',
  },
  chomp: {
    name: 'Chomp',
    description: 'Hungry and strong',
    baseColor: '#90EE90',
    highlightColor: '#98FB98',
    shadowColor: '#3CB371',
    eyeColor: '#FFFFFF',
    accentColor: '#7CFC00',
  },
  dot: {
    name: 'Dot',
    description: 'Dark and mysterious',
    baseColor: '#1A1A1A',
    highlightColor: '#333333',
    shadowColor: '#0D0D0D',
    eyeColor: '#FFFFFF',
    accentColor: '#4A4A4A',
  },
};

export function getSpeciesForFile(filePath: string): Species {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'ts': case 'tsx': case 'js': case 'jsx': return 'dot';
    case 'py': return 'puff';
    case 'go': return 'blob';
    case 'rs': case 'c': case 'cpp': case 'h': return 'chomp';
    case 'swift': case 'kt': return 'pip';
    case 'vue': case 'svelte': return 'wisp';
    default: return 'wisp';
  }
}
