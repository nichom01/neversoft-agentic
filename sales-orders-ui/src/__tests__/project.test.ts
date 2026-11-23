import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');
const pkg = () => JSON.parse(read('package.json')) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  engines?: { node?: string };
  workspaces?: unknown;
};

describe('T-21 README content', () => {
  it('exists', () => {
    expect(existsSync(resolve(root, 'README.md'))).toBe(true);
  });

  it('documents Node version, commands and URL', () => {
    const readme = read('README.md');
    expect(readme).toMatch(/Node\.js\s+\d+/);
    for (const text of [
      'npm install',
      'npm run dev',
      'npm run build',
      'npm run typecheck',
      'http://localhost:5173',
    ]) {
      expect(readme).toContain(text);
    }
  });

  it('mentions localStorage and client-side only', () => {
    const readme = read('README.md');
    expect(readme).toContain('localStorage');
    expect(readme).toMatch(/client-side only/i);
    expect(readme).toMatch(/no backend/i);
  });

  it('only names npm scripts that exist', () => {
    const scripts = Object.keys(pkg().scripts);
    const names = [...read('README.md').matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(scripts).toContain(name);
  });

  it('states a Node version consistent with engines.node', () => {
    const engines = pkg().engines?.node;
    if (!engines) return;
    const readmeVersion = read('README.md').match(/Node\.js\s+(\d+)(?:\.(\d+))?/);
    const enginesVersion = engines.match(/(\d+)(?:\.(\d+))?/);
    expect(readmeVersion).not.toBeNull();
    expect(enginesVersion).not.toBeNull();
    expect(Number(readmeVersion?.[1])).toBe(Number(enginesVersion?.[1]));
    expect(Number(readmeVersion?.[2] ?? 0)).toBe(Number(enginesVersion?.[2] ?? 0));
  });
});

describe('T-22 project configuration and dependency hygiene', () => {
  it('defines dev, build, typecheck and test scripts', () => {
    const { scripts } = pkg();
    for (const name of ['dev', 'build', 'typecheck', 'test']) expect(scripts).toHaveProperty(name);
  });

  it('includes react, react-dom and vite', () => {
    const p = pkg();
    expect(p.dependencies).toHaveProperty('react');
    expect(p.dependencies).toHaveProperty('react-dom');
    expect({ ...p.dependencies, ...p.devDependencies }).toHaveProperty('vite');
  });

  it('enables strict TypeScript', () => {
    expect(read('tsconfig.json')).toMatch(/"strict"\s*:\s*true/);
  });

  it('has a package-lock.json', () => {
    expect(existsSync(resolve(root, 'package-lock.json'))).toBe(true);
  });

  it('index.html has the root element and entry script', () => {
    const html = read('index.html');
    expect(html).toContain('id="root"');
    expect(html).toContain('/src/main.tsx');
  });

  it('is independent of the root package.json (no workspaces)', () => {
    expect(pkg().workspaces).toBeUndefined();
    const rootPkg = JSON.parse(readFileSync(resolve(root, '../package.json'), 'utf8')) as {
      workspaces?: unknown;
    };
    expect(rootPkg.workspaces).toBeUndefined();
  });
});
