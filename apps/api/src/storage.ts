import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type StorageDriver = "local" | "s3";

export interface StorageConfig {
  driver: StorageDriver;
  uploadsDir: string;
  bucket: string | null;
  region: string;
  endpoint: string | null;
  accessKey: string | null;
  secretKey: string | null;
}

export interface ReceiptStorage {
  readonly kind: StorageDriver;
  readonly bucket: string | null;
  put(key: string, content: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export class LocalReceiptStorage implements ReceiptStorage {
  readonly kind = "local" as const;
  readonly bucket = null;
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = resolve(baseDir);
  }

  async put(key: string, content: Buffer): Promise<void> {
    const target = resolve(this.baseDir, key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(resolve(this.baseDir, key));
  }

  async delete(key: string): Promise<void> {
    await unlink(resolve(this.baseDir, key)).catch(() => undefined);
  }
}

export class S3ReceiptStorage implements ReceiptStorage {
  readonly kind = "s3" as const;
  readonly bucket: string;
  private readonly client: S3Client;

  constructor(config: StorageConfig) {
    if (!config.bucket || !config.accessKey || !config.secretKey) {
      throw new Error(
        "STORAGE_DRIVER=s3 requiere S3_BUCKET, S3_ACCESS_KEY y S3_SECRET_KEY",
      );
    }
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region || "auto",
      endpoint: config.endpoint ?? undefined,
      forcePathStyle: Boolean(config.endpoint),
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
  }

  async put(key: string, content: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error("El archivo no existe en el storage");
    }
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

export function createReceiptStorage(config: StorageConfig): ReceiptStorage {
  if (config.driver === "s3") {
    return new S3ReceiptStorage(config);
  }
  return new LocalReceiptStorage(resolve(config.uploadsDir));
}

export function receiptKeyFromPath(path: string, bucket: string | null): string {
  const prefix = bucket ? `s3://${bucket}/` : "s3://";
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
