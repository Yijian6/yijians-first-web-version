// 首页动画控制
document.addEventListener('DOMContentLoaded', function() {
    const intro = document.getElementById('intro');
    const main = document.getElementById('main');

    // 动画结束后显示主内容
    setTimeout(function() {
        intro.style.display = 'none';
        main.classList.remove('hidden');
    }, 2500);

    // 标签页切换功能
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            // 移除所有active状态
            tabBtns.forEach(function(b) {
                b.classList.remove('active');
            });
            tabContents.forEach(function(c) {
                c.classList.remove('active');
            });

            // 添加当前active状态
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // 导航栏高亮当前页面
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(function(link) {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
});