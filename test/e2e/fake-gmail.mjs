/*
 * A stand-in for Gmail used by the end-to-end tests.
 *
 * Chromium is started with --host-resolver-rules so that mail.google.com and
 * mail-attachment.googleusercontent.com resolve to this local HTTPS server.
 * Like Gmail, it serves an inbox page with attachment cards, answers
 * attachment URLs with a redirect to the attachment host, and serves files
 * there with "Content-Disposition: attachment" (which makes Chrome download
 * them unless Tabachment steps in).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const fixtures = new URL('./fixtures/', import.meta.url);

/** A one-page PDF with a line of (ASCII) text. */
function makePdf(text) {
  const content = `BT /F1 24 Tf 24 60 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 120] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

/** A solid-colour RGB PNG. */
function makePng(width, height, [r, g, b]) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CSV = '姓名,城市\n王小明,台北市\n陳美麗,高雄市\n';

/** Attachments by Gmail's realattid. `type` is the Content-Type the server sends. */
export const FILES = {
  f_pdf: { name: 'report 報告.pdf', type: 'application/pdf', body: makePdf('Tabachment test PDF') },
  f_octet: { name: 'scan.pdf', type: 'application/octet-stream', body: makePdf('Octet-stream PDF') },
  f_png: { name: 'photo.png', type: 'image/png', body: makePng(40, 30, [79, 70, 229]) },
  f_csv: { name: 'data.csv', type: 'text/csv', body: Buffer.from(CSV, 'utf8') },
  f_csv_sandbox: {
    name: 'sandboxed.csv',
    type: 'text/csv',
    body: Buffer.from(CSV, 'utf8'),
    headers: { 'content-security-policy': 'sandbox' },
  },
  f_big5: {
    name: 'big5.txt',
    type: 'text/plain; charset=Big5',
    body: Buffer.from('a96da6572cabb0a5ab0aa4fda470a9fa2ca578a55fa5ab0ab3afacfcc4522cb0aab6afa5ab0a', 'hex'),
  },
  f_json: { name: 'config.json', type: 'application/json; charset=UTF-8', body: Buffer.from('{"城市":"台北市"}\n', 'utf8') },
  f_docx: {
    name: 'memo.docx',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    body: Buffer.from('PK\u0003\u0004 not really a document', 'latin1'),
  },
  f_evil: {
    name: 'invoice.pdf',
    type: 'text/html',
    body: Buffer.from('<script>document.title = "PWNED"</script><h1>HTML pretending to be a PDF</h1>'),
  },
  f_draft: { name: 'draft-notes.txt', type: 'text/plain', body: Buffer.from('Draft notes from the compose window\n') },
  f_late: { name: 'late.png', type: 'image/png', body: makePng(20, 20, [34, 197, 94]) },
};

function makeCertificate(dir) {
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2',
      '-keyout', key, '-out', cert,
      '-subj', '/CN=mail.google.com',
      '-addext', 'subjectAltName=DNS:mail.google.com,DNS:mail-attachment.googleusercontent.com',
    ],
    { stdio: 'ignore' },
  );
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}

export function hasOpenSsl() {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function startFakeGmail() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tabachment-e2e-'));
  const inbox = fs.readFileSync(new URL('inbox.html', fixtures));
  const requests = [];

  const server = https.createServer(makeCertificate(dir), (req, res) => {
    const host = String(req.headers.host || '').split(':')[0];
    const url = new URL(req.url, `https://${host}`);
    requests.push(`${host}${url.pathname}${url.search}`);

    if (host === 'mail.google.com' && url.searchParams.get('view') === 'att') {
      // Gmail answers with a short-lived URL on its attachment host.
      res.writeHead(302, {
        location: `https://mail-attachment.googleusercontent.com/attachment/u/0/${url.search}&saddbat=token${requests.length}`,
        'content-type': 'text/html; charset=UTF-8',
      });
      return res.end();
    }
    if (host === 'mail.google.com' && url.pathname.startsWith('/mail/')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(inbox);
    }
    const file = host === 'mail-attachment.googleusercontent.com' && FILES[url.searchParams.get('realattid')];
    if (file && url.pathname.startsWith('/attachment/')) {
      res.writeHead(200, {
        'content-type': file.type,
        'content-disposition': `attachment; filename="${file.name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'x-content-type-options': 'nosniff',
        'cache-control': 'private, max-age=0',
        ...file.headers,
      });
      return res.end(file.body);
    }
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<h1>Not found</h1>');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: server.address().port,
    requests,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          fs.rmSync(dir, { recursive: true, force: true });
          resolve();
        });
      }),
  };
}
