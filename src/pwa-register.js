// GESTAO_PROJETOS_PWA_V3
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => console.warn("Service Worker nÃ£o registrado:", error));
  });
}
