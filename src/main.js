import { createApp } from 'vue'

// 初始化CSS
import 'normalize.css/normalize.css'


// Vant函数组件的样式
import 'vant/es/toast/style';
import 'vant/es/dialog/style';
import 'vant/es/notify/style';
import 'vant/es/image-preview/style';


import App from './App.vue'

createApp(App).mount('#app')
