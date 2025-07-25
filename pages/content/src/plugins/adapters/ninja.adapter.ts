import { BaseAdapterPlugin } from './base.adapter';
import type { AdapterCapability, PluginContext } from '../plugin-types';

/**
 * Ninja Adapter for NinjaAI (myninja.ai)
 *
 * Provides basic text insertion and form submission support.
 */
export class NinjaAdapter extends BaseAdapterPlugin {
  readonly name = 'NinjaAdapter';
  readonly version = '1.0.0';
  readonly hostnames = ['myninja.ai'];
  readonly capabilities: AdapterCapability[] = [
    'text-insertion',
    'form-submission',
    'file-attachment',
    'dom-manipulation',
  ];

  private readonly selectors = {
    CHAT_INPUT: 'textarea[placeholder*="Ask anything"]',
    SUBMIT_BUTTON: 'button.nj-chat-form--submit-button, button[data-e2e="main-submit-button"]',
    FILE_UPLOAD_BUTTON: 'button[data-tooltip-content="Attach files"], button[aria-label*="attach"]',
    FILE_INPUT: 'input[type="file"]',
    MAIN_PANEL: '.nj-thread-view--chat',
    DROP_ZONE: 'textarea.ThreadInputBox_textArea__caqN+',
    FILE_PREVIEW: '.file-preview, .attachment-preview',
    BUTTON_INSERTION_CONTAINER: '.SkillCommandSection_root__j71Rq',
    FALLBACK_INSERTION: '.ChatThreadModelSelector_root__jG6O+',
  } as const;

  async initialize(context: PluginContext): Promise<void> {
    await super.initialize(context);
  }

  async insertText(text: string): Promise<boolean> {
    const el = document.querySelector<HTMLTextAreaElement | HTMLElement>(
      this.selectors.CHAT_INPUT
    );
    if (!el) {
      this.context.logger.error('Ninja chat input not found');
      return false;
    }
    if (el instanceof HTMLTextAreaElement) {
      el.value = text;
    } else {
      el.textContent = text;
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    (el as HTMLElement).focus();
    return true;
  }

  async submitForm(): Promise<boolean> {
    const btn = document.querySelector<HTMLButtonElement>(
      this.selectors.SUBMIT_BUTTON
    );
    if (!btn) return false;
    btn.click();
    return true;
  }
}
