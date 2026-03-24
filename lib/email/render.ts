/**
 * Renders a React Email component to HTML + plain-text strings.
 */
import { render } from "@react-email/render";
import type { ReactElement } from "react";

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderEmail(component: ReactElement): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([
    render(component, { pretty: false }),
    render(component, { plainText: true }),
  ]);
  return { html, text };
}
