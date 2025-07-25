/**
 * Simple utilities for NinjaAI chat input
 */

import { logMessage } from '@src/utils/helpers';

let lastFoundInputElement: HTMLElement | null = null;

export const findChatInputElement = (): HTMLElement | null => {
  const selectors = [
    'textarea.ThreadInputBox_textArea__caqN+',
    'textarea[placeholder*="Ask anything"]',
    'div[contenteditable="true"]'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      lastFoundInputElement = el as HTMLElement;
      return el as HTMLElement;
    }
  }

  if (lastFoundInputElement && document.body.contains(lastFoundInputElement)) {
    return lastFoundInputElement;
  }

  return null;
};

export const insertTextToChatInput = (text: string): boolean => {
  const input = findChatInputElement();
  if (!input) {
    logMessage('Could not find NinjaAI input element');
    return false;
  }
  if (input.tagName === 'TEXTAREA') {
    (input as HTMLTextAreaElement).value = text;
  } else {
    input.textContent = text;
  }
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  (input as HTMLElement).focus();
  return true;
};

export const submitChatInput = async (): Promise<boolean> => {
  const button = document.querySelector<HTMLButtonElement>(
    'button.nj-chat-form--submit-button, button[data-e2e="main-submit-button"]'
  );
  if (!button) return false;
  button.click();
  return true;
};

export const attachFileToInput = async (file: File): Promise<boolean> => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) return false;
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
};
