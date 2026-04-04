import { describe, it, expect } from 'vitest';
import { getSpeciesForFile } from './SpeciesData';

describe('getSpeciesForFile', () => {
  it('.ts → dot', () => {
    expect(getSpeciesForFile('src/index.ts')).toBe('dot');
  });

  it('.tsx → dot', () => {
    expect(getSpeciesForFile('App.tsx')).toBe('dot');
  });

  it('.js → dot', () => {
    expect(getSpeciesForFile('main.js')).toBe('dot');
  });

  it('.jsx → dot', () => {
    expect(getSpeciesForFile('Component.jsx')).toBe('dot');
  });

  it('.py → puff', () => {
    expect(getSpeciesForFile('script.py')).toBe('puff');
  });

  it('.go → blob', () => {
    expect(getSpeciesForFile('main.go')).toBe('blob');
  });

  it('.rs → chomp', () => {
    expect(getSpeciesForFile('lib.rs')).toBe('chomp');
  });

  it('.c → chomp', () => {
    expect(getSpeciesForFile('main.c')).toBe('chomp');
  });

  it('.cpp → chomp', () => {
    expect(getSpeciesForFile('app.cpp')).toBe('chomp');
  });

  it('.swift → pip', () => {
    expect(getSpeciesForFile('ViewController.swift')).toBe('pip');
  });

  it('.kt → pip', () => {
    expect(getSpeciesForFile('Main.kt')).toBe('pip');
  });

  it('.vue → wisp', () => {
    expect(getSpeciesForFile('App.vue')).toBe('wisp');
  });

  it('.svelte → wisp', () => {
    expect(getSpeciesForFile('Page.svelte')).toBe('wisp');
  });

  it('unknown extension → wisp', () => {
    expect(getSpeciesForFile('readme.txt')).toBe('wisp');
  });

  it('no extension → wisp', () => {
    expect(getSpeciesForFile('Makefile')).toBe('wisp');
  });
});
