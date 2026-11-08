const test=require('node:test');
const assert=require('node:assert/strict');
const {deflateRawSync}=require('node:zlib');
const {extractKriticDocument}=require('../lib/kritic-document-extract.ts');
const {validateKriticInput}=require('../lib/kritic-validation.ts');

function zipOne(name,body) {
 const content=Buffer.from(body), zipped=deflateRawSync(content), nameBuf=Buffer.from(name);
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(8,8);local.writeUInt32LE(zipped.length,18);local.writeUInt32LE(content.length,22);local.writeUInt16LE(nameBuf.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(8,10);central.writeUInt32LE(zipped.length,20);central.writeUInt32LE(content.length,24);central.writeUInt16LE(nameBuf.length,28);
 const first=Buffer.concat([local,nameBuf,zipped]);const middle=Buffer.concat([central,nameBuf]);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(middle.length,12);end.writeUInt32LE(first.length,16);
 return Buffer.concat([first,middle,end]);
}
test('DOCX extraction preserves paragraphs, tables and decoded XML entities',()=>{
 const xml='<w:document><w:body><w:p><w:r><w:t>Essay &amp; citations</w:t></w:r></w:p><w:tr><w:tc><w:t>Results</w:t></w:tc><w:tc><w:t>2026</w:t></w:tc></w:tr></w:body></w:document>';
 const result=extractKriticDocument(zipOne('word/document.xml',xml),'docx');
 assert.match(result,/Essay & citations/);
 assert.match(result,/Results\s+2026/);
});
test('TXT rejects binary payload and decodes Unicode',()=>{
 assert.equal(extractKriticDocument(Buffer.from('A student's research notes on Botswana'),'txt'),"A student's research notes on Botswana");
 assert.throws(()=>extractKriticDocument(Buffer.from([65,0,66]),'txt'),/binary/);
});
test('legacy DOC validates OLE signature and fails clearly for unreadable files',()=>{
 assert.throws(()=>extractKriticDocument(Buffer.from('not a Word file'),'doc'),/Invalid legacy DOC/);
});
test('validation allows only two references with permitted academic extensions',()=>{
 const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 for(const ext of ['pdf','doc','docx','txt','jpg','jpeg','png','webp']) {
  const path=user+'/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.'+ext;
  assert.deepEqual(validateKriticInput({promptText:'Review my assignment',filePaths:[path]}).filePaths,[path]);
 }
 assert.throws(()=>validateKriticInput({promptText:'Review',filePaths:[user+'/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.exe']}));
});
