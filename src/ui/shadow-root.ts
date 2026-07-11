// mounts a react tree into an open shadow root so host-page css can't wreck us
// (and our styles can't wreck the host).

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

const HOST_ID = 'tecora-root';

let root: Root | null = null;

export function mountShadowApp(app: React.ReactNode, styles: string): Root {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    // sit above the page chrome but don't block clicks when closed
    host.style.cssText = 'all:initial; position:fixed; inset:0; z-index:2147483646; pointer-events:none;';
    document.documentElement.appendChild(host);
  }

  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });

  let styleEl = shadow.querySelector('style[data-tecora]');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.setAttribute('data-tecora', '1');
    shadow.prepend(styleEl);
  }
  styleEl.textContent = styles;

  let mount = shadow.querySelector('#tecora-app') as HTMLElement | null;
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'tecora-app';
    mount.style.cssText = 'pointer-events:none;';
    shadow.appendChild(mount);
  }

  if (!root) root = createRoot(mount);
  root.render(app);
  return root;
}
