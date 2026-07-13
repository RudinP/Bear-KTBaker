import JSZip from 'jszip';
import { ANDROID_SAMPLE_COLORS } from '../manifest/kakaoColors';

export interface AndroidCompiledMetadata {
  colors?: Record<string, string>;
  name?: string;
  resourcePackage?: string;
  version?: string;
  themeId?: string;
  appearance?: 'light' | 'dark';
}

const STRING_POOL = 0x0001;
const XML = 0x0003;
const XML_START_NAMESPACE = 0x0100;
const XML_END_NAMESPACE = 0x0101;
const XML_START_ELEMENT = 0x0102;
const XML_END_ELEMENT = 0x0103;
const TABLE = 0x0002;
const TABLE_PACKAGE = 0x0200;
const TABLE_TYPE = 0x0201;
const UTF8_FLAG = 0x00000100;
const NO_ENTRY = 0xffffffff;

function requireRange(buffer: Buffer, offset: number, length: number, label: string) {
  if (!Number.isInteger(offset) || offset < 0 || length < 0 || offset + length > buffer.length) {
    throw new Error(`손상된 Android ${label} 데이터입니다.`);
  }
}

function chunk(buffer: Buffer, offset: number) {
  requireRange(buffer, offset, 8, '리소스 청크');
  const type = buffer.readUInt16LE(offset);
  const headerSize = buffer.readUInt16LE(offset + 2);
  const size = buffer.readUInt32LE(offset + 4);
  if (headerSize < 8 || size < headerSize) throw new Error('손상된 Android 리소스 청크입니다.');
  requireRange(buffer, offset, size, '리소스 청크');
  return { type, headerSize, size };
}

function variableLength8(buffer: Buffer, offset: number) {
  requireRange(buffer, offset, 1, '문자열');
  const first = buffer[offset];
  if ((first & 0x80) === 0) return { value: first, bytes: 1 };
  requireRange(buffer, offset, 2, '문자열');
  return { value: ((first & 0x7f) << 8) | buffer[offset + 1], bytes: 2 };
}

function variableLength16(buffer: Buffer, offset: number) {
  requireRange(buffer, offset, 2, '문자열');
  const first = buffer.readUInt16LE(offset);
  if ((first & 0x8000) === 0) return { value: first, bytes: 2 };
  requireRange(buffer, offset, 4, '문자열');
  return { value: ((first & 0x7fff) << 16) | buffer.readUInt16LE(offset + 2), bytes: 4 };
}

function readStringPool(buffer: Buffer, offset: number) {
  const header = chunk(buffer, offset);
  if (header.type !== STRING_POOL || header.headerSize < 28) throw new Error('Android 문자열 풀이 없습니다.');
  const stringCount = buffer.readUInt32LE(offset + 8);
  const flags = buffer.readUInt32LE(offset + 16);
  const stringsStart = buffer.readUInt32LE(offset + 20);
  const utf8 = (flags & UTF8_FLAG) !== 0;
  const offsetsStart = offset + header.headerSize;
  requireRange(buffer, offsetsStart, stringCount * 4, '문자열 인덱스');
  const strings: string[] = [];

  for (let index = 0; index < stringCount; index += 1) {
    const relative = buffer.readUInt32LE(offsetsStart + index * 4);
    let cursor = offset + stringsStart + relative;
    if (utf8) {
      const utf16Length = variableLength8(buffer, cursor);
      cursor += utf16Length.bytes;
      const byteLength = variableLength8(buffer, cursor);
      cursor += byteLength.bytes;
      requireRange(buffer, cursor, byteLength.value, 'UTF-8 문자열');
      strings.push(buffer.toString('utf8', cursor, cursor + byteLength.value));
    } else {
      const length = variableLength16(buffer, cursor);
      cursor += length.bytes;
      requireRange(buffer, cursor, length.value * 2, 'UTF-16 문자열');
      strings.push(buffer.toString('utf16le', cursor, cursor + length.value * 2));
    }
  }
  return { strings, size: header.size };
}

type XmlValue = string | number | boolean | { reference: number } | undefined;
interface XmlNode { name: string; attributes: Record<string, XmlValue>; children: XmlNode[] }

function typedValue(buffer: Buffer, offset: number, strings: string[]): XmlValue {
  requireRange(buffer, offset, 8, 'XML 속성');
  const dataType = buffer[offset + 3];
  const data = buffer.readUInt32LE(offset + 4);
  if (dataType === 0x01) return { reference: data };
  if (dataType === 0x03) return strings[data];
  if (dataType === 0x10) return data | 0;
  if (dataType === 0x11) return data >>> 0;
  if (dataType === 0x12) return data !== 0;
  return undefined;
}

function readBinaryXml(buffer: Buffer) {
  const outer = chunk(buffer, 0);
  if (outer.type !== XML) throw new Error('AndroidManifest.xml이 바이너리 XML 형식이 아닙니다.');
  let strings: string[] = [];
  const namespaces = new Map<string, string>();
  const stack: XmlNode[] = [];
  let root: XmlNode | undefined;
  let position = outer.headerSize;

  while (position < outer.size) {
    const current = chunk(buffer, position);
    if (current.type === STRING_POOL) {
      strings = readStringPool(buffer, position).strings;
    } else if (current.type === XML_START_NAMESPACE) {
      requireRange(buffer, position, 24, 'XML 네임스페이스');
      const prefix = strings[buffer.readUInt32LE(position + 16)] ?? '';
      const uri = strings[buffer.readUInt32LE(position + 20)] ?? '';
      namespaces.set(uri, prefix);
    } else if (current.type === XML_END_NAMESPACE) {
      requireRange(buffer, position, 24, 'XML 네임스페이스');
      const uri = strings[buffer.readUInt32LE(position + 20)] ?? '';
      namespaces.delete(uri);
    } else if (current.type === XML_START_ELEMENT) {
      requireRange(buffer, position, 36, 'XML 요소');
      const name = strings[buffer.readUInt32LE(position + 20)] ?? '';
      const attributeStart = buffer.readUInt16LE(position + 24);
      const attributeSize = buffer.readUInt16LE(position + 26);
      const attributeCount = buffer.readUInt16LE(position + 28);
      if (attributeSize < 20) throw new Error('손상된 Android XML 속성입니다.');
      const attributes: Record<string, XmlValue> = {};
      const base = position + 16 + attributeStart;
      requireRange(buffer, base, attributeSize * attributeCount, 'XML 속성');
      for (let index = 0; index < attributeCount; index += 1) {
        const attribute = base + index * attributeSize;
        const namespaceIndex = buffer.readInt32LE(attribute);
        const attributeName = strings[buffer.readUInt32LE(attribute + 4)] ?? '';
        const rawIndex = buffer.readInt32LE(attribute + 8);
        const namespace = namespaceIndex >= 0 ? strings[namespaceIndex] : undefined;
        const prefix = namespace ? namespaces.get(namespace) : undefined;
        const key = prefix ? `${prefix}:${attributeName}` : attributeName;
        const value = rawIndex >= 0 ? strings[rawIndex] : typedValue(buffer, attribute + 12, strings);
        attributes[key] = value;
        // Callers only need the local Android attribute name. Keeping both makes
        // manifests compiled with a non-standard namespace prefix work too.
        if (!(attributeName in attributes)) attributes[attributeName] = value;
      }
      const node: XmlNode = { name, attributes, children: [] };
      if (stack.length) stack[stack.length - 1].children.push(node);
      else root = node;
      stack.push(node);
    } else if (current.type === XML_END_ELEMENT) {
      stack.pop();
    }
    position += current.size;
  }
  return root;
}

function packedLocale(buffer: Buffer, offset: number) {
  requireRange(buffer, offset, 2, '리소스 설정');
  const first = buffer[offset];
  const second = buffer[offset + 1];
  if (!first && !second) return '';
  if ((first & 0x80) === 0) return String.fromCharCode(first, second).replace(/\0/g, '');
  return String.fromCharCode(
    (second & 0x1f) + 0x61,
    ((second & 0xe0) >> 5 | (first & 0x03) << 3) + 0x61,
    ((first & 0x7c) >> 2) + 0x61,
  );
}

interface ResourceCandidate { value: string | number | boolean | { reference: number } | undefined; language: string; score: number }

function resourceValue(buffer: Buffer, offset: number, globalStrings: string[]): ResourceCandidate['value'] {
  requireRange(buffer, offset, 8, '리소스 값');
  const dataType = buffer[offset + 3];
  const data = buffer.readUInt32LE(offset + 4);
  if (dataType === 0x01) return { reference: data };
  if (dataType === 0x03) return globalStrings[data];
  if (dataType === 0x10) return data | 0;
  if (dataType === 0x11 || (dataType >= 0x1c && dataType <= 0x1f)) return data >>> 0;
  if (dataType === 0x12) return data !== 0;
  return undefined;
}

function configScore(buffer: Buffer, offset: number, size: number) {
  // Prefer the unqualified/default resource. Bytes after the size field encode
  // locale, density, SDK and other qualifiers; every non-zero byte lowers rank.
  let score = 0;
  const end = Math.min(buffer.length, offset + size);
  for (let cursor = offset + 4; cursor < end; cursor += 1) if (buffer[cursor] !== 0) score += 1;
  return score;
}

function readResourceTable(buffer: Buffer) {
  const outer = chunk(buffer, 0);
  if (outer.type !== TABLE) throw new Error('resources.arsc가 Android 리소스 테이블 형식이 아닙니다.');
  let position = outer.headerSize;
  let globalStrings: string[] = [];
  let packageName: string | undefined;
  const resources = new Map<string, Map<string, ResourceCandidate[]>>();

  while (position < outer.size) {
    const current = chunk(buffer, position);
    if (current.type === STRING_POOL && globalStrings.length === 0) {
      globalStrings = readStringPool(buffer, position).strings;
    } else if (current.type === TABLE_PACKAGE) {
      const packageEnd = position + current.size;
      if (current.headerSize < 284) throw new Error('손상된 Android 패키지 테이블 데이터입니다.');
      requireRange(buffer, position, current.headerSize, '패키지 테이블');
      packageName ??= buffer.toString('utf16le', position + 12, position + 268).split('\0', 1)[0] || undefined;
      const typeStringsOffset = buffer.readUInt32LE(position + 268);
      const keyStringsOffset = buffer.readUInt32LE(position + 276);
      const typeStrings = readStringPool(buffer, position + typeStringsOffset).strings;
      const keyStrings = readStringPool(buffer, position + keyStringsOffset).strings;
      let child = position + current.headerSize;

      while (child < packageEnd) {
        const nested = chunk(buffer, child);
        if (nested.type === TABLE_TYPE) {
          requireRange(buffer, child, 24, '타입 테이블');
          const typeId = buffer[child + 8];
          const flags = buffer[child + 9];
          const entryCount = buffer.readUInt32LE(child + 12);
          const entriesStart = buffer.readUInt32LE(child + 16);
          const typeName = typeStrings[typeId - 1];
          const configOffset = child + 20;
          const configSize = buffer.readUInt32LE(configOffset);
          const language = configSize >= 12 ? packedLocale(buffer, configOffset + 8) : '';
          const score = configScore(buffer, configOffset, configSize);
          const entryBase = child + entriesStart;
          const offsetsStart = child + nested.headerSize;
          const entries: Array<[number, number]> = [];

          if ((flags & 0x01) !== 0) {
            requireRange(buffer, offsetsStart, entryCount * 4, '희소 리소스 인덱스');
            for (let index = 0; index < entryCount; index += 1) {
              entries.push([
                buffer.readUInt16LE(offsetsStart + index * 4),
                buffer.readUInt16LE(offsetsStart + index * 4 + 2) * 4,
              ]);
            }
          } else if ((flags & 0x02) !== 0) {
            requireRange(buffer, offsetsStart, entryCount * 2, '리소스 인덱스');
            for (let index = 0; index < entryCount; index += 1) {
              const encoded = buffer.readUInt16LE(offsetsStart + index * 2);
              if (encoded !== 0xffff) entries.push([index, encoded * 4]);
            }
          } else {
            requireRange(buffer, offsetsStart, entryCount * 4, '리소스 인덱스');
            for (let index = 0; index < entryCount; index += 1) {
              const relative = buffer.readUInt32LE(offsetsStart + index * 4);
              if (relative !== NO_ENTRY) entries.push([index, relative]);
            }
          }

          for (const [, relative] of entries) {
            const entry = entryBase + relative;
            requireRange(buffer, entry, 8, '리소스 엔트리');
            const entrySize = buffer.readUInt16LE(entry);
            const entryFlags = buffer.readUInt16LE(entry + 2);
            const key = keyStrings[buffer.readUInt32LE(entry + 4)];
            if (!typeName || !key || (entryFlags & 0x0001) !== 0) continue;
            const value = resourceValue(buffer, entry + entrySize, globalStrings);
            let byName = resources.get(typeName);
            if (!byName) resources.set(typeName, byName = new Map());
            const candidates = byName.get(key) ?? [];
            candidates.push({ value, language, score });
            byName.set(key, candidates);
          }
        }
        child += nested.size;
      }
    }
    position += current.size;
  }
  return { packageName, resources };
}

function candidate(
  resources: Map<string, Map<string, ResourceCandidate[]>>,
  type: string,
  name: string,
  preferredLanguage?: string,
) {
  const values = resources.get(type)?.get(name) ?? [];
  return [...values].sort((left, right) => {
    const leftLanguage = preferredLanguage && left.language === preferredLanguage ? -100 : left.language ? 10 : 0;
    const rightLanguage = preferredLanguage && right.language === preferredLanguage ? -100 : right.language ? 10 : 0;
    return leftLanguage + left.score - (rightLanguage + right.score);
  })[0]?.value;
}

function normalizeColor(value: ResourceCandidate['value']) {
  if (typeof value !== 'number') return undefined;
  const hex = (value >>> 0).toString(16).padStart(8, '0').toUpperCase();
  return hex.startsWith('FF') ? `#${hex.slice(2)}` : `#${hex}`;
}

function descendants(node: XmlNode | undefined, name: string): XmlNode[] {
  if (!node) return [];
  const result: XmlNode[] = node.name === name ? [node] : [];
  for (const child of node.children) result.push(...descendants(child, name));
  return result;
}

/**
 * Reads the small, documented metadata surface needed by the editor from a
 * compiled APK. It intentionally does not execute or decompile application
 * code and does not require Java, Android Studio, aapt or aapt2.
 */
export async function inspectCompiledAndroidApk(source: Buffer): Promise<AndroidCompiledMetadata> {
  const zip = await JSZip.loadAsync(source);
  const manifestBuffer = await zip.file('AndroidManifest.xml')?.async('nodebuffer');
  const tableBuffer = await zip.file('resources.arsc')?.async('nodebuffer');
  if (!manifestBuffer) throw new Error('AndroidManifest.xml이 없는 APK입니다.');

  const manifest = readBinaryXml(manifestBuffer);
  if (!manifest || manifest.name !== 'manifest') throw new Error('올바른 AndroidManifest.xml이 아닙니다.');
  const themeId = typeof manifest.attributes.package === 'string' ? manifest.attributes.package : undefined;
  const version = typeof manifest.attributes.versionName === 'string' ? manifest.attributes.versionName : undefined;
  const dark = descendants(manifest, 'meta-data').some((node) =>
    node.attributes.name === 'com.kakao.talk.theme_style' && node.attributes.value === 'dark');

  const result: AndroidCompiledMetadata = {
    ...(themeId ? { themeId } : {}),
    ...(version ? { version } : {}),
    appearance: dark ? 'dark' : 'light',
  };
  if (!tableBuffer) return result;

  const { packageName: resourcePackage, resources } = readResourceTable(tableBuffer);
  if (resourcePackage) result.resourcePackage = resourcePackage;
  const colors: Record<string, string> = {};
  for (const name of Object.keys(ANDROID_SAMPLE_COLORS)) {
    const parsed = normalizeColor(candidate(resources, 'color', name));
    if (parsed) colors[name] = parsed;
  }
  const title = candidate(resources, 'string', 'theme_title', 'ko');
  if (typeof title === 'string') result.name = title;
  if (Object.keys(colors).length) result.colors = colors;
  return result;
}
