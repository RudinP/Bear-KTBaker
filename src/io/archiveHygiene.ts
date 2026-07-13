import JSZip from 'jszip';

export function isMacosArchiveJunk(entryName: string) {
  const segments = entryName.replace(/\\/g, '/').split('/').filter(Boolean);
  return segments.some((segment) => {
    const lower = segment.toLowerCase();
    return lower === '__macosx'
      || lower === '.ds_store'
      || lower.startsWith('._')
      || /^\.?com\.apple\.(?:quarantine|metadata(?::.*)?)$/i.test(segment);
  });
}

export async function generateCleanIosThemeArchive(source: JSZip) {
  const clean = new JSZip();
  for (const entry of Object.values(source.files)) {
    if (entry.dir || isMacosArchiveJunk(entry.name)) continue;
    clean.file(entry.name, await entry.async('nodebuffer'), {
      binary: true,
      createFolders: false,
      date: entry.date,
    });
  }
  return clean.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
