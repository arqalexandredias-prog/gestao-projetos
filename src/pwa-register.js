function registerPWA() {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      registration.update();
      console.info("PWA registrado:", registration.scope);
    } catch (error) {
      console.warn("NÃ£o foi possÃ­vel registrar o PWA:", error);
    }
  });
}

registerPWA();

