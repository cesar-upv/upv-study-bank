import DOMPurify from 'dompurify';

export interface DiagramColors { background: string; surface: string; text: string; muted: string; border: string; accent: string; dark: boolean }

export function validateDiagram(source: string) {
  if (source.length > 20000) throw new Error('El diagrama supera el límite de 20.000 caracteres.');
  if (/%%\s*\{|^\s*---|\b(?:click|style|classDef|linkStyle|cssClass)\s|(?:https?:|javascript:|data:|file:|url\s*\(|@import)/im.test(source)) {
    throw new Error('Usa un diagrama sin configuración, estilos, enlaces ni recursos externos.');
  }
}
export function sanitizeDiagram(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true },
    FORBID_TAGS: ['foreignObject', 'a', 'image', 'script', 'iframe'],
    FORBID_ATTR: ['href', 'xlink:href', 'onload', 'onclick', 'onerror'],
  });
}
// Mermaid has global configuration. Serialize initialize+render, including theme changes.
let queue: Promise<unknown> = Promise.resolve();
let nextId = 0;
export function renderDiagram(source: string, colors: DiagramColors): Promise<string> {
  const task = queue.catch(() => {}).then(async () => {
    validateDiagram(source);
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({
      startOnLoad: false, securityLevel: 'strict', theme: 'base', suppressErrorRendering: true,
      maxTextSize: 20000, maxEdges: 200, htmlLabels: false,
      secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'maxEdges', 'htmlLabels', 'theme', 'themeVariables', 'flowchart', 'suppressErrorRendering'],
      flowchart: { htmlLabels: false, useMaxWidth: true },
      themeVariables: {
        darkMode: colors.dark, background: colors.background, primaryColor: colors.surface,
        primaryTextColor: colors.text, primaryBorderColor: colors.border,
        secondaryColor: colors.background, secondaryTextColor: colors.text,
        tertiaryColor: colors.surface, tertiaryTextColor: colors.text,
        lineColor: colors.muted, textColor: colors.text,
        mainBkg: colors.surface, nodeBorder: colors.border,
        actorBkg: colors.surface, actorTextColor: colors.text, actorBorder: colors.border,
        actorLineColor: colors.muted, signalColor: colors.text, signalTextColor: colors.text,
        labelBoxBkgColor: colors.surface, labelBoxBorderColor: colors.border, labelTextColor: colors.text,
        activationBkgColor: colors.surface, activationBorderColor: colors.accent,
        noteBkgColor: colors.surface, noteTextColor: colors.text, noteBorderColor: colors.border,
        edgeLabelBackground: colors.background, clusterBkg: colors.background, clusterBorder: colors.border,
        titleColor: colors.text, fontFamily: 'system-ui, sans-serif',
      },
    });
    const { svg } = await mermaid.render(`study-diagram-${++nextId}`, source);
    return sanitizeDiagram(svg);
  });
  queue = task;
  return task;
}
