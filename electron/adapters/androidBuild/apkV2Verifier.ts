import {
  constants as cryptoConstants,
  createHash,
  timingSafeEqual,
  verify as verifySignature,
  X509Certificate,
} from 'node:crypto';

const APK_SIG_BLOCK_MAGIC = Buffer.from(
  'APK Sig Block 42',
  'ascii',
);
const APK_SIGNATURE_SCHEME_V2_BLOCK_ID = 0x7109871a;
const RSA_PKCS1_SHA256_ALGORITHM_ID = 0x0103;
const APK_CONTENT_CHUNK_SIZE = 1024 * 1024;

interface ApkV2Sections {
  beforeSigningBlock: Buffer;
  centralDirectory: Buffer;
  eocd: Buffer;
  signingBlockPairs: Buffer;
  signingBlockOffset: number;
}

interface LengthPrefixedCursor {
  bytes: Buffer;
  offset: number;
}

interface V2Signer {
  signedData: Buffer;
  signatures: Array<{
    algorithmId: number;
    signature: Buffer;
  }>;
  publicKey: Buffer;
  digests: Array<{
    algorithmId: number;
    digest: Buffer;
  }>;
  certificates: Buffer[];
  additionalAttributes: Buffer;
}

export function verifyStandaloneApkSignatureV2(
  apkBytes: Uint8Array,
) {
  try {
    const apk = Buffer.from(apkBytes);
    const sections = parseApkV2Sections(apk);
    const v2Block = findV2SigningBlock(
      sections.signingBlockPairs,
    );
    const signers = parseV2Signers(v2Block);
    if (signers.length !== 1) {
      throw new Error('expected exactly one v2 signer');
    }
    const contentDigest = calculateApkV2ContentDigest(sections);
    verifyV2Signer(signers[0], contentDigest);
    return {
      hasV2SigningBlock: true as const,
      algorithmId: RSA_PKCS1_SHA256_ALGORITHM_ID,
    };
  } catch (cause) {
    throw new Error(
      'Android APK V2 서명 검증에 실패했습니다.',
      { cause },
    );
  }
}

function parseApkV2Sections(apk: Buffer): ApkV2Sections {
  const eocdOffset = findZipEocdOffset(apk);
  if (
    apk.readUInt16LE(eocdOffset + 4) !== 0
    || apk.readUInt16LE(eocdOffset + 6) !== 0
    || apk.readUInt16LE(eocdOffset + 8)
      !== apk.readUInt16LE(eocdOffset + 10)
  ) {
    throw new Error('unsupported multi-disk ZIP');
  }
  const centralDirectorySize = apk.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = apk.readUInt32LE(
    eocdOffset + 16,
  );
  if (
    centralDirectorySize === 0xffffffff
    || centralDirectoryOffset === 0xffffffff
    || centralDirectoryOffset + centralDirectorySize
      !== eocdOffset
    || centralDirectoryOffset < 32
  ) {
    throw new Error('invalid central directory');
  }

  const footerOffset = centralDirectoryOffset - 24;
  if (
    footerOffset < 8
    || !apk.subarray(
      footerOffset + 8,
      centralDirectoryOffset,
    ).equals(APK_SIG_BLOCK_MAGIC)
  ) {
    throw new Error('missing signing block footer');
  }
  const footerSize = readSafeUint64(apk, footerOffset);
  if (footerSize < 24 || footerSize > centralDirectoryOffset - 8) {
    throw new Error('invalid signing block size');
  }
  const signingBlockOffset =
    centralDirectoryOffset - footerSize - 8;
  if (
    signingBlockOffset < 0
    || readSafeUint64(apk, signingBlockOffset) !== footerSize
  ) {
    throw new Error('mismatched signing block sizes');
  }
  const pairStart = signingBlockOffset + 8;
  const pairEnd = footerOffset;
  if (pairStart >= pairEnd) throw new Error('empty signing block');

  const eocd = Buffer.from(apk.subarray(eocdOffset));
  eocd.writeUInt32LE(signingBlockOffset, 16);
  return {
    beforeSigningBlock: apk.subarray(0, signingBlockOffset),
    centralDirectory: apk.subarray(
      centralDirectoryOffset,
      eocdOffset,
    ),
    eocd,
    signingBlockPairs: apk.subarray(pairStart, pairEnd),
    signingBlockOffset,
  };
}

function findZipEocdOffset(apk: Buffer) {
  if (apk.length < 22) throw new Error('truncated ZIP');
  const minimum = Math.max(0, apk.length - 22 - 0xffff);
  for (
    let offset = apk.length - 22;
    offset >= minimum;
    offset -= 1
  ) {
    if (
      apk.readUInt32LE(offset) !== 0x06054b50
      || offset + 22 + apk.readUInt16LE(offset + 20)
        !== apk.length
    ) {
      continue;
    }
    return offset;
  }
  throw new Error('missing ZIP EOCD');
}

function readSafeUint64(bytes: Buffer, offset: number) {
  if (offset < 0 || offset + 8 > bytes.length) {
    throw new Error('truncated uint64');
  }
  const value = bytes.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('oversized uint64');
  }
  return Number(value);
}

function findV2SigningBlock(pairs: Buffer) {
  let offset = 0;
  let v2Block: Buffer | undefined;
  while (offset < pairs.length) {
    const pairLength = readSafeUint64(pairs, offset);
    offset += 8;
    if (
      pairLength < 4
      || offset + pairLength > pairs.length
    ) {
      throw new Error('invalid signing pair');
    }
    const id = pairs.readUInt32LE(offset);
    const value = pairs.subarray(
      offset + 4,
      offset + pairLength,
    );
    if (id === APK_SIGNATURE_SCHEME_V2_BLOCK_ID) {
      if (v2Block) throw new Error('duplicate v2 block');
      v2Block = value;
    }
    offset += pairLength;
  }
  if (offset !== pairs.length || !v2Block) {
    throw new Error('missing v2 block');
  }
  return v2Block;
}

function parseV2Signers(v2Block: Buffer): V2Signer[] {
  const outer = cursor(v2Block);
  const signerSequence = readLengthPrefixed(outer);
  requireConsumed(outer);
  const sequence = cursor(signerSequence);
  const signers: V2Signer[] = [];
  while (sequence.offset < sequence.bytes.length) {
    signers.push(parseV2Signer(readLengthPrefixed(sequence)));
  }
  requireConsumed(sequence);
  return signers;
}

function parseV2Signer(bytes: Buffer): V2Signer {
  const signer = cursor(bytes);
  const signedData = readLengthPrefixed(signer);
  const signatureBytes = readLengthPrefixed(signer);
  const publicKey = readLengthPrefixed(signer);
  requireConsumed(signer);

  const signed = cursor(signedData);
  const digestBytes = readLengthPrefixed(signed);
  const certificateBytes = readLengthPrefixed(signed);
  const additionalAttributes = readLengthPrefixed(signed);
  requireConsumed(signed);
  return {
    signedData,
    signatures: parseAlgorithmRecords(
      signatureBytes,
      'signature',
    ) as V2Signer['signatures'],
    publicKey,
    digests: parseAlgorithmRecords(
      digestBytes,
      'digest',
    ) as V2Signer['digests'],
    certificates: parseCertificateRecords(certificateBytes),
    additionalAttributes,
  };
}

function parseAlgorithmRecords(
  bytes: Buffer,
  valueName: 'signature' | 'digest',
) {
  const sequence = cursor(bytes);
  const records: Array<{
    algorithmId: number;
    signature?: Buffer;
    digest?: Buffer;
  }> = [];
  const seen = new Set<number>();
  while (sequence.offset < sequence.bytes.length) {
    const record = cursor(readLengthPrefixed(sequence));
    const algorithmId = readUint32(record);
    const value = readLengthPrefixed(record);
    requireConsumed(record);
    if (seen.has(algorithmId)) {
      throw new Error('duplicate algorithm');
    }
    seen.add(algorithmId);
    records.push({
      algorithmId,
      [valueName]: value,
    });
  }
  requireConsumed(sequence);
  return records;
}

function parseCertificateRecords(bytes: Buffer) {
  const sequence = cursor(bytes);
  const certificates: Buffer[] = [];
  while (sequence.offset < sequence.bytes.length) {
    certificates.push(readLengthPrefixed(sequence));
  }
  requireConsumed(sequence);
  return certificates;
}

function cursor(bytes: Buffer): LengthPrefixedCursor {
  return { bytes, offset: 0 };
}

function readUint32(input: LengthPrefixedCursor) {
  if (input.offset + 4 > input.bytes.length) {
    throw new Error('truncated uint32');
  }
  const value = input.bytes.readUInt32LE(input.offset);
  input.offset += 4;
  return value;
}

function readLengthPrefixed(input: LengthPrefixedCursor) {
  const length = readUint32(input);
  if (input.offset + length > input.bytes.length) {
    throw new Error('truncated length-prefixed field');
  }
  const value = input.bytes.subarray(
    input.offset,
    input.offset + length,
  );
  input.offset += length;
  return value;
}

function requireConsumed(input: LengthPrefixedCursor) {
  if (input.offset !== input.bytes.length) {
    throw new Error('trailing signed data');
  }
}

function verifyV2Signer(
  signer: V2Signer,
  contentDigest: Buffer,
) {
  if (
    signer.signatures.length !== 1
    || signer.digests.length !== 1
    || signer.signatures[0].algorithmId
      !== RSA_PKCS1_SHA256_ALGORITHM_ID
    || signer.digests[0].algorithmId
      !== RSA_PKCS1_SHA256_ALGORITHM_ID
  ) {
    throw new Error('unsupported signer algorithm shape');
  }
  if (signer.certificates.length !== 1) {
    throw new Error('expected exactly one signer certificate');
  }
  if (signer.additionalAttributes.length !== 0) {
    throw new Error(
      'additional signer attributes are unsupported',
    );
  }
  const [signature] = signer.signatures;
  const [digest] = signer.digests;
  const certificateBytes = signer.certificates[0];
  if (
    digest.digest.length !== 32
  ) {
    throw new Error('unsupported or incomplete signer');
  }
  if (!safeEqual(digest.digest, contentDigest)) {
    throw new Error('APK content digest differs');
  }

  const certificate = new X509Certificate(certificateBytes);
  if (!safeEqual(certificate.raw, certificateBytes)) {
    throw new Error('signer certificate encoding differs');
  }
  const certificatePublicKey = Buffer.from(
    certificate.publicKey.export({
      type: 'spki',
      format: 'der',
    }),
  );
  if (!safeEqual(certificatePublicKey, signer.publicKey)) {
    throw new Error('certificate public key differs');
  }
  if (
    certificate.subject === certificate.issuer
    && !certificate.verify(certificate.publicKey)
  ) {
    throw new Error('self-signed certificate is invalid');
  }
  if (!verifySignature(
    'sha256',
    signer.signedData,
    {
      key: certificate.publicKey,
      padding: cryptoConstants.RSA_PKCS1_PADDING,
    },
    signature.signature,
  )) {
    throw new Error('signer signature is invalid');
  }
}

function safeEqual(left: Uint8Array, right: Uint8Array) {
  return left.length === right.length
    && timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function calculateApkV2ContentDigest(
  sections: ApkV2Sections,
) {
  const chunkDigests: Buffer[] = [];
  for (const section of [
    sections.beforeSigningBlock,
    sections.centralDirectory,
    sections.eocd,
  ]) {
    for (
      let offset = 0;
      offset < section.length;
      offset += APK_CONTENT_CHUNK_SIZE
    ) {
      const chunk = section.subarray(
        offset,
        Math.min(
          section.length,
          offset + APK_CONTENT_CHUNK_SIZE,
        ),
      );
      const header = Buffer.alloc(5);
      header[0] = 0xa5;
      header.writeUInt32LE(chunk.length, 1);
      chunkDigests.push(
        createHash('sha256')
          .update(header)
          .update(chunk)
          .digest(),
      );
    }
  }
  const header = Buffer.alloc(5);
  header[0] = 0x5a;
  header.writeUInt32LE(chunkDigests.length, 1);
  return createHash('sha256')
    .update(header)
    .update(Buffer.concat(chunkDigests))
    .digest();
}
