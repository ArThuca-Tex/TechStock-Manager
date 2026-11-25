const landingLoader = document.querySelector('.landing-loader');
if (landingLoader) {
  const cinemaRoot = document.querySelector('.cinema');
  let pageReady = document.readyState === 'complete';
  let sceneReady = cinemaRoot.hasAttribute('data-scene-ready');
  const timeout = window.setTimeout(finishLoading, 4000);

  function finishLoading() {
    landingLoader.hidden = true;
    window.clearTimeout(timeout);
  }

  function checkReady() {
    if (pageReady && sceneReady) finishLoading();
  }

  landingLoader.hidden = false;
  window.addEventListener('load', () => {
    pageReady = true;
    checkReady();
  }, { once: true });
  cinemaRoot.addEventListener('scene-ready', () => {
    sceneReady = true;
    checkReady();
  }, { once: true });
  checkReady();
}
