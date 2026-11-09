import { inflateRawSync } from 'node:zlib';

const MAX_TEXT = 120_000;
function readableText(text: string, label: string): string {
  const cleaned = text.replace(/\u0000/g, '').trim();
  if (cleaned.length < 3) throw new Error(label + ' contains no readable text.');
  return cleaned.length > MAX_TEXT
    ? cleaned.slice(0, MAX_TEXT) + '\\n[DOCUMENT TRUNCATED: later text was not included. Ask the student to upload relevant sections separately.]'
    : cleaned;
}
function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (full, entity: string) => {
    if (entity === 'amp') return '&';
    if (entity === 'lt') return '<';
    if (entity === 'gt') return '>';
    if (entity === 'quot') return '"';
    if (entity === 'apos') return "'";
    const number = entity.startsWith('#x') ? parseInt(entity.slice(2),16) : entity.startsWith('#') ? parseInt(entity.slice(1),10) : -1;
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : full;
  });
}
function extractDocxXml(buffer: Buffer): string {
  // Read the ZIP central directory, not arbitrary compressed content. Never extract to disk.
  const endStart = Math.max(0,buffer.length - 65557);
  let end = -1;
  for(let i=buffer.length-22;i>=endStart;i--) if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0) throw new Error('Invalid DOCX archive.');
  const count=buffer.readUInt16LE(end+10);
  if(count>2000) throw new Error('DOCX has too many embedded entries.');
  let offset=buffer.readUInt32LE(end+16);
  const centralSize=buffer.readUInt32LE(end+12);
  if(offset+centralSize>buffer.length) throw new Error('Invalid DOCX archive directory.');
  const fragments: string[]=[];
  let total=0;
  for(let i=0;i<count;i++){
    if(offset+46>buffer.length||buffer.readUInt32LE(offset)!==0x02014b50) throw new Error('Invalid DOCX archive entry.');
    const method=buffer.readUInt16LE(offset+10), compressed=buffer.readUInt32LE(offset+20), uncompressed=buffer.readUInt32LE(offset+24);
    const nameLength=buffer.readUInt16LE(offset+28),extra=buffer.readUInt16LE(offset+30),comment=buffer.readUInt16LE(offset+32);
    const local=buffer.readUInt32LE(offset+42);
    const name=buffer.subarray(offset+46,offset+46+nameLength).toString('utf8');
    offset+=46+nameLength+extra+comment;
    if(!/^word\/(document|footnotes|endnotes|comments|header[0-9]+|footer[0-9]+)\.xml$/.test(name))continue;
    if(uncompressed>2_000_000||total+uncompressed>4_000_000)throw new Error('DOCX expanded content is too large.');
    if(local+30>buffer.length||buffer.readUInt32LE(local)!==0x04034b50)throw new Error('Invalid DOCX data.');
    const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);
    if(start+compressed>buffer.length)throw new Error('Truncated DOCX data.');
    const raw=buffer.subarray(start,start+compressed);
    const xml=method===0?raw:method===8?inflateRawSync(raw,{maxOutputLength:2_000_001}):null;
    if(!xml||xml.length!==uncompressed)throw new Error('Invalid DOCX compression.');
    total+=uncompressed;
    const decoded=xml.toString('utf8')
      .replace(/<w:tab\b[^>]*\/>/g,'\t')
      .replace(/<w:br\b[^>]*\/>/g,'\n')
      .replace(/<\/w:p>/g,'\n')
      .replace(/<\/w:tr>/g,'\n')
      .replace(/<\/w:tc>/g,'\t');
    const text=decodeXmlEntities(decoded.replace(/<[^>]*>/g,''));
    fragments.push(text);
  }
  if(!fragments.length)throw new Error('DOCX is missing readable Word content.');
  return readableText(fragments.join('\n'),'DOCX');
}
function extractLegacyDoc(buffer: Buffer): string {
  // Legacy OLE Word files are not ZIP. Recover readable Unicode/ANSI runs.
  // This is a best-effort text extraction; complex DOC formatting may be lost.
  if(!buffer.subarray(0,8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])))throw new Error('Invalid legacy DOC file.');
  const unicode: string[]=[];
  for(const match of Array.from(buffer.toString('utf16le').matchAll(/[\p{L}\p{N}][\p{L}\p{N}\p{P}\p{Zs}\t\r\n]{24,}/gu)))unicode.push(match[0]);
  const ascii: string[]=[];
  for(const match of Array.from(buffer.toString('latin1').matchAll(/[A-Za-z0-9][\x20-\x7e\r\n\t]{35,}/g)))ascii.push(match[0]);
  const best=unicode.join('\n').length>=ascii.join('\n').length?unicode:ascii;
  if(!best.length)throw new Error('This legacy DOC could not be read. Save it as DOCX or PDF and retry.');
  return readableText(best.join('\n'),'DOC');
}
export function extractKriticDocument(bytes: Buffer, extension: string): string {
  if(bytes.length===0||bytes.length>10*1024*1024)throw new Error('Document must be 10 MB or smaller.');
  if(extension==='docx')return extractDocxXml(bytes);
  if(extension==='doc')return extractLegacyDoc(bytes);
  if(extension==='txt'){
    if(bytes.includes(0))throw new Error('TXT contains binary data.');
    return readableText(new TextDecoder('utf-8',{fatal:true}).decode(bytes),'TXT');
  }
  throw new Error('Unsupported document type.');
}
