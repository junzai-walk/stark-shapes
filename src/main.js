// src/main.js
// 这是Vite的入口文件，用于导入所有需要的资源

// 导入样式
import '../styles.css';

// 导入自定义脚本
import '../geometry.js';
import '../main.js';
import '../chromatic-shader.js';

// 注意：在Vite中，我们不需要手动导入CDN资源，因为它们已经在HTML中通过script标签加载
// 如果需要，可以将这些CDN资源替换为npm包，但这需要更多的代码重构
