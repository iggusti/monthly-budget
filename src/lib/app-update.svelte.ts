import { t } from "./i18n.svelte";
import { toastAction } from "./toast.svelte";

const VERSION_KEY = "fhb-app-version";

export function checkAppUpdate(): void {
  if (typeof window === "undefined") return;
  const previous = localStorage.getItem(VERSION_KEY);
  if (previous === __APP_VERSION__) return;
  if (previous === null) {
    localStorage.setItem(VERSION_KEY, __APP_VERSION__);
    return;
  }
  toastAction(t("update.message"), t("update.reload"), () => {
    localStorage.setItem(VERSION_KEY, __APP_VERSION__);
    window.location.reload();
  });
}
