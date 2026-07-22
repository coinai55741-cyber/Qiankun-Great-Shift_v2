const { createApp } = Vue;

createApp({
    data() {
        return {
            appName: '阿黑的客字繪卷'
        };
    },
    mounted() {
        document.documentElement.classList.add('vue-ready');
    }
}).mount('#app');
