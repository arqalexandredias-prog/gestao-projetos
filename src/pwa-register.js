// GESTAO_PROJETOS_PWA_V6
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      await navigator.serviceWorker.register("/sw.js?v=6");
    } catch (error) {
      console.warn("Service Worker nÃ£o registrado:", error);
    }
  });
}
