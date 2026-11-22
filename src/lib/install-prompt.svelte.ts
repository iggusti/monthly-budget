type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

class InstallPrompt {
  event: InstallEvent | null = $state(null);

  init(): void {
    if (typeof window === "undefined") return;
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      this.event = event as InstallEvent;
    });
    window.addEventListener("appinstalled", () => {
      this.event = null;
    });
  }

  get installed(): boolean {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }

  get available(): boolean {
    return this.event !== null && !this.installed;
  }

  async prompt(): Promise<void> {
    const event = this.event;
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    this.event = null;
  }
}

export const installPrompt = new InstallPrompt();
