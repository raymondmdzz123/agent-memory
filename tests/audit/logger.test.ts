import { AuditLogger } from '../../src/audit/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function waitForFile(filePath: string, timeout = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.trim().length > 0) {
          resolve(content);
          return;
        }
      } catch { /* file not ready yet */ }
      if (Date.now() - start > timeout) {
        reject(new Error(`Timeout waiting for ${filePath}`));
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

describe('AuditLogger', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates the data directory', async () => {
    const nested = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-nested-'));
    const deepDir = path.join(nested, 'deep', 'nested');
    const l = new AuditLogger(deepDir);
    expect(fs.existsSync(deepDir)).toBe(true);
    l.close();
    await new Promise((r) => setTimeout(r, 200));
    fs.rmSync(nested, { recursive: true, force: true });
  });

  it('writes audit entries as JSON lines', async () => {
    const logger = new AuditLogger(tmpDir);
    logger.log({ action: 'append_message', targetId: 1, details: 'user' });
    logger.log({ action: 'save_memory', targetId: 'ltm_1', details: 'fact:test' });
    logger.close();

    const content = await waitForFile(path.join(tmpDir, 'audit.log'));
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(2);

    const entry1 = JSON.parse(lines[0]);
    expect(entry1.action).toBe('append_message');
    expect(entry1.targetId).toBe(1);
    expect(entry1.timestamp).toBeDefined();

    const entry2 = JSON.parse(lines[1]);
    expect(entry2.action).toBe('save_memory');
  });

  it('logs entry without optional fields', async () => {
    const logger = new AuditLogger(tmpDir);
    logger.log({ action: 'maintenance' });
    logger.close();

    const content = await waitForFile(path.join(tmpDir, 'audit.log'));
    const entry = JSON.parse(content.trim());
    expect(entry.action).toBe('maintenance');
    expect(entry.targetId).toBeUndefined();
  });
});
