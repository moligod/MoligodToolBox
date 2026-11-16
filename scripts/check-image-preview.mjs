// Browser regression harness: actual decoder + actual desktop CSP + known-valid PNG.
// Run with node scripts/check-image-preview.mjs, then open http://127.0.0.1:1431.
// Refresh after editing the CSP; it is loaded again for every request.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import ts from "typescript";

createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.url === "/decoder.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(
      ts.transpileModule(readFileSync("src/image-preview.ts", "utf8"), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ES2020,
        },
      }).outputText,
    );
  } else if (request.url === "/check.js") {
    response.setHeader("Content-Type", "text/javascript");
    const bytes = [...readFileSync("src-tauri/icons/32x32.png")];
    response.end(`import {decodePngPreview} from '/decoder.js';
      document.addEventListener('securitypolicyviolation',event=>{document.querySelector('#policy').textContent=event.violatedDirective+': '+event.blockedURI;});
      try {
        const {image,url}=await decodePngPreview(${JSON.stringify(bytes)});
        if(image.naturalWidth!==32 || image.naturalHeight!==32) throw new Error('Incorrect PNG dimensions');
        document.querySelector('#result').textContent='PASS: PNG decoded 32×32';
        document.body.append(image);
        URL.revokeObjectURL(url);
      } catch(error) { document.querySelector('#result').textContent='FAIL: '+String(error); }
    `);
  } else {
    const csp = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"))
      .app.security.csp;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Content-Security-Policy", csp);
    response.end(
      '<!doctype html><html><head><meta charset="utf-8"><title>Image preview CSP regression</title><script type="module" src="/check.js"></script></head><body><h1 id="result">Running</h1><p id="policy"></p></body></html>',
    );
  }
}).listen(1431, "127.0.0.1", () =>
  console.log("Preview decoder regression: http://127.0.0.1:1431"),
);
