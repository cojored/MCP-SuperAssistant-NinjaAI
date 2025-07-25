import { BaseAdapterPlugin } from './base.adapter';
import type { AdapterCapability, PluginContext } from '../plugin-types';

/**
 * Ninja Adapter for NinjaAI (myninja.ai)
 *
 * Provides basic text insertion and form submission support.
 */
export class NinjaAdapter extends BaseAdapterPlugin {
  readonly name = 'NinjaAdapter';
  readonly version = '2.0.0';
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

  private mcpPopoverContainer: HTMLElement | null = null;
  private mcpPopoverRoot: any = null;
  private mutationObserver: MutationObserver | null = null;
  private domObserversSetup = false;
  private uiIntegrationSetup = false;
  private adapterStylesInjected = false;

  async initialize(context: PluginContext): Promise<void> {
    await super.initialize(context);
  }

  async activate(): Promise<void> {
    await super.activate();

    this.injectNinjaButtonStyles();
    this.setupDOMObservers();
    this.setupUIIntegration();
  }

  async deactivate(): Promise<void> {
    await super.deactivate();

    this.cleanupUIIntegration();
    this.cleanupDOMObservers();
  }

  async cleanup(): Promise<void> {
    await super.cleanup();
    this.cleanupUIIntegration();

    const styleEl = document.getElementById('mcp-ninja-button-styles');
    if (styleEl) styleEl.remove();

    this.adapterStylesInjected = false;
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

  private getNinjaButtonStyles(): string {
    return `
      .mcp-ninja-button-base {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        background: transparent;
        color: inherit;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      .mcp-ninja-button-base:hover {
        background-color: rgba(0,0,0,0.05);
      }
      .mcp-ninja-button-content {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .mcp-ninja-button-text {
        font-size: 14px;
      }
      .mcp-ninja-button-base.mcp-button-active {
        background-color: rgba(0,0,0,0.1);
      }
    `;
  }

  private injectNinjaButtonStyles(): void {
    if (this.adapterStylesInjected) return;
    const styleId = 'mcp-ninja-button-styles';
    const existing = document.getElementById(styleId);
    if (existing) existing.remove();

    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = this.getNinjaButtonStyles();
    document.head.appendChild(el);
    this.adapterStylesInjected = true;
  }

  private setupDOMObservers(): void {
    if (this.domObserversSetup) return;
    this.mutationObserver = new MutationObserver(() => {
      if (!document.getElementById('mcp-popover-container')) {
        const insertion = this.findButtonInsertionPoint();
        if (insertion) this.injectMCPPopoverWithRetry();
      }
    });
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
    this.domObserversSetup = true;
  }

  private cleanupDOMObservers(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    this.domObserversSetup = false;
  }

  private setupUIIntegration(): void {
    if (this.uiIntegrationSetup) return;
    this.uiIntegrationSetup = true;
    this.waitForPageReady().then(() => this.injectMCPPopoverWithRetry());
  }

  private cleanupUIIntegration(): void {
    if (this.mcpPopoverRoot) {
      try { this.mcpPopoverRoot.unmount(); } catch {}
      this.mcpPopoverRoot = null;
    }
    const container = document.getElementById('mcp-popover-container');
    if (container) container.remove();
    this.mcpPopoverContainer = null;
    this.uiIntegrationSetup = false;
  }

  private waitForPageReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        attempts += 1;
        if (this.findButtonInsertionPoint()) {
          resolve();
        } else if (attempts > 10) {
          reject(new Error('insertion point not found'));
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    });
  }

  private injectMCPPopoverWithRetry(retries = 5): void {
    const attempt = (n: number) => {
      if (document.getElementById('mcp-popover-container')) return;
      const insertion = this.findButtonInsertionPoint();
      if (insertion) {
        this.injectMCPPopover(insertion);
      } else if (n < retries) {
        setTimeout(() => attempt(n + 1), 1000);
      }
    };
    attempt(0);
  }

  private findButtonInsertionPoint(): { container: Element; insertAfter: Element | null } | null {
    const container = document.querySelector(this.selectors.BUTTON_INSERTION_CONTAINER);
    if (container) {
      const buttons = container.querySelectorAll('button');
      const lastBtn = buttons.length ? buttons[buttons.length - 1] : null;
      return { container, insertAfter: lastBtn };
    }
    const fallback = document.querySelector(this.selectors.FALLBACK_INSERTION);
    if (fallback) return { container: fallback, insertAfter: null };
    return null;
  }

  private injectMCPPopover(insertion: { container: Element; insertAfter: Element | null }): void {
    if (document.getElementById('mcp-popover-container')) return;

    const div = document.createElement('div');
    div.id = 'mcp-popover-container';
    div.style.display = 'inline-block';
    div.style.margin = '0 4px';

    if (insertion.insertAfter && insertion.insertAfter.parentNode === insertion.container) {
      insertion.container.insertBefore(div, insertion.insertAfter.nextSibling);
    } else {
      insertion.container.appendChild(div);
    }

    this.mcpPopoverContainer = div;
    this.renderMCPPopover(div);
  }

  private renderMCPPopover(container: HTMLElement): void {
    import('react').then(React => {
      import('react-dom/client').then(ReactDOM => {
        import('../../components/mcpPopover/mcpPopover').then(({ MCPPopover }) => {
          const toggleStateManager = this.createToggleStateManager();
          const adapterButtonConfig = {
            className: 'mcp-ninja-button-base',
            contentClassName: 'mcp-ninja-button-content',
            textClassName: 'mcp-ninja-button-text',
            activeClassName: 'mcp-button-active'
          };
          this.mcpPopoverRoot = ReactDOM.createRoot(container);
          this.mcpPopoverRoot.render(
            React.createElement(MCPPopover, {
              toggleStateManager,
              adapterButtonConfig,
              adapterName: this.name,
            })
          );
        });
      });
    });
  }

  private createToggleStateManager() {
    const context = this.context;
    return {
      getState: () => {
        const uiState = context.stores.ui;
        const mcpEnabled = uiState?.mcpEnabled ?? false;
        const autoSubmitEnabled = uiState?.preferences?.autoSubmit ?? false;
        return {
          mcpEnabled,
          autoInsert: autoSubmitEnabled,
          autoSubmit: autoSubmitEnabled,
          autoExecute: false,
        };
      },
      setMCPEnabled: (enabled: boolean) => {
        if (context.stores.ui?.setMCPEnabled) {
          context.stores.ui.setMCPEnabled(enabled, 'mcp-popover-toggle');
        }
        this.updateToggleUI();
      },
      setAutoInsert: (enabled: boolean) => {
        if (context.stores.ui?.updatePreferences) {
          context.stores.ui.updatePreferences({ autoSubmit: enabled });
        }
        this.updateToggleUI();
      },
      setAutoSubmit: (enabled: boolean) => {
        if (context.stores.ui?.updatePreferences) {
          context.stores.ui.updatePreferences({ autoSubmit: enabled });
        }
        this.updateToggleUI();
      },
      setAutoExecute: () => {},
    };
  }

  private updateToggleUI(): void {
    const container = document.getElementById('mcp-popover-container');
    if (container) {
      const event = new CustomEvent('mcp:update-toggle-state');
      container.dispatchEvent(event);
    }
  }
}
