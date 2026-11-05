#!/usr/bin/env node
"use strict";var x=Object.create;var $=Object.defineProperty;var b=Object.getOwnPropertyDescriptor;var C=Object.getOwnPropertyNames;var P=Object.getPrototypeOf,j=Object.prototype.hasOwnProperty;var w=(s,r,t,i)=>{if(r&&typeof r=="object"||typeof r=="function")for(let n of C(r))!j.call(s,n)&&n!==t&&$(s,n,{get:()=>r[n],enumerable:!(i=b(r,n))||i.enumerable});return s};var v=(s,r,t)=>(t=s!=null?x(P(s)):{},w(r||!s||!s.__esModule?$(t,"default",{value:s,enumerable:!0}):t,s));var l=require("fs"),c=require("path"),m=require("child_process"),g=v(require("readline")),e={reset:"\x1B[0m",bold:"\x1B[1m",dim:"\x1B[2m",cyan:"\x1B[36m",green:"\x1B[32m",yellow:"\x1B[33m",red:"\x1B[31m",magenta:"\x1B[35m"},h="https://www.curases.com";function A(s){let r={},t=[];for(let u=0;u<s.length;u++){let a=s[u];a==="-h"||a==="--help"?r.help=!0:a==="-v"||a==="--version"?r.version=!0:a==="-l"||a==="--list"?r.list=!0:a.startsWith("--size=")?r.size=parseFloat(a.split("=")[1]):a.startsWith("--speed=")?r.speed=parseFloat(a.split("=")[1]):a.startsWith("--color=")?r.color=a.split("=")[1]:a.startsWith("-")||t.push(a)}let i,n;return t.length>0&&(["add","install","set"].includes(t[0].toLowerCase())?(i=t[0].toLowerCase(),n=t[1]):n=t[0]),{command:i,cursor:n,options:r}}function S(){console.log(`
${e.bold}${e.cyan}\u2728 Curases CLI${e.reset}
Add dynamic custom cursors to your project in seconds.

${e.bold}USAGE${e.reset}
  ${e.green}npx curases${e.reset} [cursor-name] [options]
  ${e.green}npx curases add${e.reset} <cursor-name> [options]

${e.bold}EXAMPLES${e.reset}
  ${e.dim}$${e.reset} npx curases handy
  ${e.dim}$${e.reset} npx curases add Handy --color="#2563eb"
  ${e.dim}$${e.reset} npx curases --list

${e.bold}OPTIONS${e.reset}
  ${e.yellow}-l, --list${e.reset}          List all available cursor presets
  ${e.yellow}--size=<number>${e.reset}    Cursor scale factor (default: 1.5)
  ${e.yellow}--speed=<number>${e.reset}   Smooth movement speed (default: 1)
  ${e.yellow}--color=<hex>${e.reset}      Color override (e.g. #2563eb)
  ${e.yellow}-h, --help${e.reset}          Show this help message
  ${e.yellow}-v, --version${e.reset}       Show CLI version

${e.dim}Catalog & Documentation: https://curases.com${e.reset}
`)}async function f(){try{let s=await fetch(`${h}/cursors/manifest.json`);if(!s.ok)throw new Error("Failed to fetch manifest");return(await s.json()).cursors.map(t=>t.name||t.id)}catch{return["Handy"]}}function k(s){let r=g.createInterface({input:process.stdin,output:process.stdout});return new Promise(t=>{r.question(s,i=>{r.close(),t(i.trim())})})}function I(s){return(0,l.existsSync)((0,c.join)(s,"bun.lockb"))||(0,l.existsSync)((0,c.join)(s,"bun.lock"))?"bun":(0,l.existsSync)((0,c.join)(s,"pnpm-lock.yaml"))?"pnpm":(0,l.existsSync)((0,c.join)(s,"yarn.lock"))?"yarn":"npm"}function L(s,r){let t=(0,c.join)(s,"package.json");if(!(0,l.existsSync)(t))return;try{let n=JSON.parse((0,l.readFileSync)(t,"utf-8"));if({...n.dependencies||{},...n.devDependencies||{}}.curases){console.log(`  ${e.dim}\u2022 curases package already installed in package.json${e.reset}`);return}}catch{}console.log(`  ${e.cyan}\u{1F4E6} Installing curases via ${r}...${e.reset}`);let i=r==="yarn"?"yarn add curases":r==="pnpm"?"pnpm add curases":r==="bun"?"bun add curases":"npm install curases";try{(0,m.execSync)(i,{cwd:s,stdio:"pipe"}),console.log(`  ${e.green}\u2714 Installed curases successfully${e.reset}`)}catch{console.warn(`  ${e.yellow}\u26A0 Could not run ${i} automatically. Please run it manually.${e.reset}`)}}function z(s){let r=["app/layout.tsx","app/layout.jsx","app/layout.js","src/app/layout.tsx","src/app/layout.jsx","src/app/layout.js"];for(let n of r)if((0,l.existsSync)((0,c.join)(s,n)))return{type:"next-app",filePath:(0,c.join)(s,n)};let t=["pages/_app.tsx","pages/_app.jsx","src/pages/_app.tsx","src/pages/_app.jsx"];for(let n of t)if((0,l.existsSync)((0,c.join)(s,n)))return{type:"next-pages",filePath:(0,c.join)(s,n)};let i=["src/App.tsx","src/App.jsx","src/main.tsx","src/main.jsx"];for(let n of i)if((0,l.existsSync)((0,c.join)(s,n)))return{type:"react",filePath:(0,c.join)(s,n)};return(0,l.existsSync)((0,c.join)(s,"index.html"))?{type:"html",filePath:(0,c.join)(s,"index.html")}:null}function F(s,r,t){let i=(0,l.readFileSync)(s.filePath,"utf-8"),n=s.filePath.replace(process.cwd()+"/",""),u=[`cursor="${r}"`];t.size!==void 0&&u.push(`size={${t.size}}`),t.speed!==void 0&&u.push(`speed={${t.speed}}`),t.color&&u.push(`color="${t.color}"`);let a=`<Curases ${u.join(" ")} />`;if(s.type==="next-app"){if(i.includes("<Curases")){let p=i.replace(/<Curases[^>]*\/>/g,a);(0,l.writeFileSync)(s.filePath,p,"utf-8"),console.log(`  ${e.green}\u2714 Updated ${e.bold}${r}${e.reset}${e.green} cursor in ${n}${e.reset}`);return}let o=i,d=`import { Curases } from "curases/react";
`;if(!o.includes('from "curases/react"'))if(o.startsWith('"use client"')||o.startsWith("'use client'")){let p=o.indexOf(`
`);o=o.slice(0,p+1)+d+o.slice(p+1)}else o=d+o;o.includes("<body")?o=o.replace(/(<body[^>]*>)/i,`$1
        ${a}`):o+=`
// Note: Place ${a} inside your root <body>
`,(0,l.writeFileSync)(s.filePath,o,"utf-8"),console.log(`  ${e.green}\u2714 Injected ${e.bold}${a}${e.reset}${e.green} into ${n}${e.reset}`)}else if(s.type==="react"||s.type==="next-pages"){if(i.includes("<Curases")){let p=i.replace(/<Curases[^>]*\/>/g,a);(0,l.writeFileSync)(s.filePath,p,"utf-8"),console.log(`  ${e.green}\u2714 Updated cursor to ${e.bold}${r}${e.reset} in ${n}`);return}let o=i;o.includes('from "curases/react"')||(o=`import { Curases } from "curases/react";
`+o),o.includes("return (")&&(o=o.replace(/return\s*\(\s*(<[^>]+>)/,`return (
    $1
      ${a}`)),(0,l.writeFileSync)(s.filePath,o,"utf-8"),console.log(`  ${e.green}\u2714 Injected ${e.bold}${a}${e.reset}${e.green} into ${n}${e.reset}`)}else if(s.type==="html"){let o=[`data-cursor="${r}"`];t.size!==void 0&&o.push(`data-size="${t.size}"`),t.speed!==void 0&&o.push(`data-speed="${t.speed}"`),t.color&&o.push(`data-color="${t.color}"`);let d=`<script src="${h}/engine.js" ${o.join(" ")} defer></script>`;if(i.includes("/engine.js")){let y=i.replace(/<script[^>]*\/engine\.js[^>]*><\/script>/g,d);(0,l.writeFileSync)(s.filePath,y,"utf-8"),console.log(`  ${e.green}\u2714 Updated CDN script in ${n}${e.reset}`);return}let p=i;p.includes("</head>")?p=p.replace("</head>",`  ${d}
</head>`):p+=`
${d}
`,(0,l.writeFileSync)(s.filePath,p,"utf-8"),console.log(`  ${e.green}\u2714 Injected CDN script tag into ${n}${e.reset}`)}}async function T(){let{cursor:s,options:r}=A(process.argv.slice(2));if(r.help&&(S(),process.exit(0)),r.version&&(console.log("curases v0.2.0"),process.exit(0)),console.log(`
${e.bold}${e.cyan}\u2728 Curases CLI${e.reset}
`),r.list){let a=await f();console.log(`${e.bold}Available Cursors:${e.reset}`),a.forEach(o=>console.log(`  \u2022 ${e.green}${o}${e.reset}`)),console.log(`
Install any cursor with: ${e.dim}npx curases <name>${e.reset}
`),process.exit(0)}let t=s;if(!t){let a=await f();console.log(`Available cursors: ${a.map(d=>`${e.green}${d}${e.reset}`).join(", ")}`),t=await k(`? Which cursor would you like to use? [${e.cyan}Handy${e.reset}]: `)||"Handy"}t=t.charAt(0).toUpperCase()+t.slice(1);let i=process.cwd(),n=z(i);n||(console.log(`${e.yellow}\u26A0 Could not automatically detect a layout file or index.html in this directory.${e.reset}`),console.log(`
You can use it manually by running:`),console.log(`  ${e.cyan}npm install curases${e.reset}`),console.log(`
And adding to your component:`),console.log(`  ${e.dim}import { Curases } from "curases/react";${e.reset}`),console.log(`  ${e.dim}<Curases cursor="${t}" />${e.reset}
`),process.exit(0));let u={"next-app":"Next.js (App Router)","next-pages":"Next.js (Pages Router)",react:"React / Vite",html:"Static HTML"}[n.type];if(console.log(`  ${e.cyan}\u{1F50D} Detected project:${e.reset} ${e.bold}${u}${e.reset}`),n.type!=="html"){let a=I(i);L(i,a)}F(n,t,r),console.log(`
${e.bold}${e.green}\u{1F680} All set!${e.reset} Your ${e.bold}${t}${e.reset} cursor is configured.`),console.log(`${e.dim}Catalog & preview: https://curases.com${e.reset}
`)}T().catch(s=>{console.error(`
${e.red}Error:${e.reset}`,s.message),process.exit(1)});
