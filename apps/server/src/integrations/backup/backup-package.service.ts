import { Injectable, Logger } from '@nestjs/common';
import { EnvironmentService } from '../environment/environment.service';
import { LOCAL_STORAGE_PATH } from '../../common/helpers';
import * as path from 'path';
import * as fs from 'fs-extra';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { createGzip } from 'zlib';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const DOCMOST_VERSION = process.env.npm_package_version ?? '0.0.0';

export interface BackupResult {
  artifactPath: string;
  artifactSizeBytes: number;
}

@Injectable()
export class BackupPackageService {
  private readonly logger = new Logger(BackupPackageService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  async runBackup(workspaceId: string, jobId: string): Promise<BackupResult> {
    const backupRoot = this.environmentService.getBackupLocalPath();
    const databaseUrl = this.environmentService.getDatabaseURL();
    const storageDriver = this.environmentService.getStorageDriver();

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }

    const tmpId = randomBytes(8).toString('hex');
    const workDir = path.join(tmpdir(), `docmost-backup-${tmpId}`);
    await fs.ensureDir(workDir);

    try {
      const dbDir = path.join(workDir, 'db');
      await fs.ensureDir(dbDir);
      const sqlGzPath = path.join(dbDir, 'docmost.sql.gz');

      await this.dumpDatabase(databaseUrl, sqlGzPath);

      if (storageDriver === 'local') {
        const storageDest = path.join(workDir, 'storage');
        await fs.ensureDir(storageDest);
        if (await fs.pathExists(LOCAL_STORAGE_PATH)) {
          await fs.copy(LOCAL_STORAGE_PATH, storageDest);
        }
      }

      const metaDir = path.join(workDir, 'meta');
      await fs.ensureDir(metaDir);
      await fs.writeFile(
        path.join(metaDir, 'version.txt'),
        DOCMOST_VERSION,
        'utf8',
      );

      const manifest = {
        docmostVersion: DOCMOST_VERSION,
        createdAt: new Date().toISOString(),
        workspaceId,
        storageDriver,
        schemaVersion: 1,
      };
      await fs.writeJson(path.join(workDir, 'manifest.json'), manifest, {
        spaces: 2,
      });

      const outDir = path.join(backupRoot, workspaceId);
      await fs.ensureDir(outDir);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const artifactName = `backup-${workspaceId}-${timestamp}.tar.gz`;
      const artifactPath = path.join(outDir, artifactName);

      await this.createTarGz(workDir, artifactPath);

      const stat = await fs.stat(artifactPath);
      return {
        artifactPath: path.join(workspaceId, artifactName),
        artifactSizeBytes: stat.size,
      };
    } finally {
      await fs.remove(workDir).catch((e) =>
        this.logger.warn(`Cleanup temp dir failed: ${e}`),
      );
    }
  }

  private parseDatabaseUrl(
    databaseUrl: string,
  ): { host: string; port: string; db: string; user: string; password: string } {
    const m = databaseUrl.match(
      /^postgres(?:ql)?:\/\/([^@]+)@([^/]+)\/([^?]*)/,
    );
    if (!m) throw new Error('Invalid DATABASE_URL');
    const [, userPass, hostPort, db] = m;
    const colonIndex = userPass.indexOf(':');
    const user =
      colonIndex === -1
        ? decodeURIComponent(userPass)
        : decodeURIComponent(userPass.slice(0, colonIndex));
    const password =
      colonIndex === -1
        ? ''
        : decodeURIComponent(userPass.slice(colonIndex + 1));
    const [host, port = '5432'] = hostPort.split(':');
    return {
      host,
      port,
      db: db || 'postgres',
      user,
      password,
    };
  }

  private async dumpDatabase(databaseUrl: string, outPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let parsed: { host: string; port: string; db: string; user: string; password: string };
      try {
        parsed = this.parseDatabaseUrl(databaseUrl);
      } catch (e) {
        reject(e);
        return;
      }

      const { host, port, db, user, password } = parsed;

      const pgDump = spawn(
        'pg_dump',
        ['-h', host, '-p', port, '-U', user, '-d', db, '-F', 'p', '-f', '-'],
        {
          env: { ...process.env, PGPASSWORD: password },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const gzip = createGzip();
      const out = createWriteStream(outPath);

      pgDump.stdout!.pipe(gzip).pipe(out);

      let stderr = '';
      pgDump.stderr?.on('data', (c) => { stderr += c.toString(); });

      pgDump.on('error', (err) => {
        reject(new Error(`pg_dump failed: ${err.message}. Is pg_dump installed?`));
      });

      out.on('finish', () => resolve());
      out.on('error', reject);
      gzip.on('error', reject);
      pgDump.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`pg_dump exited ${code}: ${stderr}`));
        }
      });
    });
  }

  private async createTarGz(sourceDir: string, outPath: string): Promise<void> {
    const { execSync } = await import('child_process');
    const escapedOut = outPath.replace(/"/g, '\\"');
    const escapedSrc = sourceDir.replace(/"/g, '\\"');
    execSync(`tar -czf "${escapedOut}" -C "${escapedSrc}" .`, {
      maxBuffer: 50 * 1024 * 1024,
    });
  }
}
