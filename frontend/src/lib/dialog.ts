export type ConfirmDialogOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};

export type PromptDialogOptions = {
  title?: string;
  message: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type DialogRequest =
  | ({ kind: 'confirm'; resolve: (value: boolean) => void } & ConfirmDialogOptions)
  | ({ kind: 'prompt'; resolve: (value: string | null) => void } & PromptDialogOptions);

export const DIALOG_REQUEST_EVENT = 'lpticket:dialog-request';

function requestDialog<T>(request: Omit<DialogRequest, 'resolve'>): Promise<T> {
  if (typeof window === 'undefined') return Promise.resolve(null as T);

  return new Promise<T>((resolve) => {
    window.dispatchEvent(new CustomEvent<DialogRequest>(DIALOG_REQUEST_EVENT, {
      detail: { ...request, resolve } as DialogRequest,
    }));
  });
}

export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return requestDialog<boolean>({ kind: 'confirm', ...options } as Omit<DialogRequest, 'resolve'>);
}

export function promptDialog(options: PromptDialogOptions): Promise<string | null> {
  return requestDialog<string | null>({ kind: 'prompt', ...options } as Omit<DialogRequest, 'resolve'>);
}
