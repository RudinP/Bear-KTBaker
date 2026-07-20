import { Blob as NodeBlob } from 'node:buffer';
import { ApkSignerV2 } from 'android-package-signer';
import JSZip from 'jszip';
import type { AndroidSigningIdentity } from './types';

export async function injectStandaloneDex(resourceApk: Buffer, classesDex: Buffer) {
  const zip = await JSZip.loadAsync(resourceApk);
  zip.file('classes.dex', classesDex, { binary: true, createFolders: false });
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

let activeSignerGlobalPatches = 0;
let signerOriginalBlob: typeof globalThis.Blob | undefined;
let signerOriginalLog: typeof console.log | undefined;
let signerUsesNodeBlob = false;

function acquireSignerGlobalPatch() {
  if (activeSignerGlobalPatches === 0) {
    signerOriginalBlob = globalThis.Blob;
    signerOriginalLog = console.log;
    signerUsesNodeBlob = typeof signerOriginalBlob?.prototype?.arrayBuffer
      !== 'function';
    if (signerUsesNodeBlob) {
      Object.assign(globalThis, { Blob: NodeBlob });
    }
    console.log = (...args: unknown[]) => {
      if (args[0] !== '<<<') signerOriginalLog?.(...args);
    };
  }
  activeSignerGlobalPatches += 1;
}

function releaseSignerGlobalPatch() {
  activeSignerGlobalPatches -= 1;
  if (activeSignerGlobalPatches !== 0) return;
  if (signerOriginalLog) console.log = signerOriginalLog;
  if (signerUsesNodeBlob) {
    Object.assign(globalThis, { Blob: signerOriginalBlob });
  }
  signerOriginalBlob = undefined;
  signerOriginalLog = undefined;
  signerUsesNodeBlob = false;
}

export async function signStandaloneApk(
  unsignedApk: Buffer,
  identity: AndroidSigningIdentity,
) {
  const signer = new ApkSignerV2(identity.password, identity.alias);
  acquireSignerGlobalPatch();
  let dataUrl: string;
  try {
    dataUrl = await signer.signPackageV2(
      new Uint8Array(unsignedApk) as unknown as File,
      identity.pkcs12DataUrl,
      'KakaoTalk Theme Studio',
    );
  } finally {
    releaseSignerGlobalPatch();
  }
  const separator = dataUrl.indexOf(',');
  if (separator < 0) throw new Error('Android APK 서명 결과를 읽지 못했습니다.');
  return Buffer.from(dataUrl.slice(separator + 1), 'base64');
}

export async function verifyStandaloneApkStructure(apkBuffer: Buffer) {
  const zip = await JSZip.loadAsync(apkBuffer);
  const result = {
    hasManifest: Boolean(zip.file('AndroidManifest.xml')),
    hasResources: Boolean(zip.file('resources.arsc')),
    hasRuntime: Boolean(zip.file('classes.dex')),
  };
  if (!Object.values(result).every(Boolean)) {
    throw new Error(
      'Android APK 구조 검증에 실패했습니다. 매니페스트, 리소스 또는 실행 코드가 누락되었습니다.',
    );
  }
  return result;
}
