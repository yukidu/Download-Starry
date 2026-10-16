(() => {
  'use strict';
  if (window.StarryCatcherBrandSync) return;

  const replacements = [
    ['繁星下載', '繁星捕手'],
    ['Starry ID', '繁星通行證']
  ];
  const attrs = ['title', 'aria-label', 'placeholder'];

  function replace(value) {
    let output = String(value ?? '');
    for (const [from, to] of replacements) output = output.replaceAll(from, to);
    return output;
  }

  function normalizeElement(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      const next = replace(root.nodeValue);
      if (next !== root.nodeValue) root.nodeValue = next;
      return;
    }
    if (!(root instanceof Element) && root !== document) return;

    if (root instanceof Element) {
      for (const attr of attrs) {
        if (!root.hasAttribute(attr)) continue;
        const current = root.getAttribute(attr) || '';
        const next = replace(current);
        if (next !== current) root.setAttribute(attr, next);
      }
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const next = replace(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }

    if (root.querySelectorAll) {
      root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(element => {
        for (const attr of attrs) {
          if (!element.hasAttribute(attr)) continue;
          const current = element.getAttribute(attr) || '';
          const next = replace(current);
          if (next !== current) element.setAttribute(attr, next);
        }
      });
    }
  }

  normalizeElement(document);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') normalizeElement(record.target);
      record.addedNodes.forEach(normalizeElement);
    }
  });
  observer.observe(document.documentElement, {subtree: true, childList: true, characterData: true});

  window.StarryCatcherBrandSync = Object.freeze({normalize: () => normalizeElement(document)});
})();
