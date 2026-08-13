import { describe, expect, it } from 'vitest';
import pkg from '../package.json';

describe('package.json n8n block', () => {
  it('declares aiNodeSdkVersion as a positive integer alongside the ai-node-sdk peer dependency', () => {
    // Required by the @n8n/community-nodes `ai-node-package-json` scanner rule:
    // aiNodeSdkVersion must live inside "n8n" (not at the root) and be a positive
    // integer whenever `@n8n/ai-node-sdk` is declared in peerDependencies.
    expect(pkg.n8n.aiNodeSdkVersion).toBe(1);
    expect(Number.isInteger(pkg.n8n.aiNodeSdkVersion)).toBe(true);
    expect(pkg.n8n.aiNodeSdkVersion).toBeGreaterThan(0);
    expect(pkg.peerDependencies).toHaveProperty('@n8n/ai-node-sdk');
    expect((pkg as { aiNodeSdkVersion?: unknown }).aiNodeSdkVersion).toBeUndefined();
  });
});
