// GESTAO_PROJETOS_PWA_V5
export function registerPwa() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      await navigator.serviceWorker.register("/sw.js?v=5");
    } catch (error) {
      console.warn("Service Worker nÃ£o registrado:", error);
    }
  });
}

registerPwa();
