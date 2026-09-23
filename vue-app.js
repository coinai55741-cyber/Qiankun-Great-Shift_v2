(function () {
    const app = document.getElementById('app');
    if (app) app.removeAttribute('v-cloak');
    document.documentElement.classList.add('vue-ready');
})();
