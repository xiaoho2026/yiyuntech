/* ==========================================================================
   四川义云科技有限公司官网 —— 交互脚本
   零依赖。三件事：应用站点配置、渲染 Hero 抽象网络、滚动进场 + 移动端菜单。
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var C = CFG.contact || {};
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     1. 应用站点配置（唯一数据源：assets/js/site.config.js）
     ------------------------------------------------------------------ */
  function applyConfig() {
    var items = [];
    if (C.phone) items.push({ k: '电话', v: C.phone, href: 'tel:' + C.phone.replace(/\s/g, '') });
    if (C.email) items.push({ k: '邮箱', v: C.email, href: 'mailto:' + C.email });
    if (C.wechat) items.push({ k: '微信', v: C.wechat, href: '' });
    if (C.address) items.push({ k: '地址', v: C.address, href: '' });

    var list = document.getElementById('contactList');
    if (list) {
      if (!items.length) {
        list.hidden = true;
      } else {
        items.forEach(function (it) {
          var li = document.createElement('li');
          var k = document.createElement('span');
          k.className = 'contact-k';
          k.textContent = it.k;
          li.appendChild(k);
          if (it.href) {
            var a = document.createElement('a');
            a.href = it.href;
            a.textContent = it.v;
            li.appendChild(a);
          } else {
            li.appendChild(document.createTextNode(it.v));
          }
          list.appendChild(li);
        });
      }
    }

    // 主转化入口：优先邮箱，其次电话，都没有则保持锚点并标记待配置
    var primary = C.email
      ? 'mailto:' + C.email
      : (C.phone ? 'tel:' + C.phone.replace(/\s/g, '') : '');

    var ctas = document.querySelectorAll('[data-contact-cta]');
    Array.prototype.forEach.call(ctas, function (el) {
      if (primary) {
        el.setAttribute('href', primary);
      } else {
        el.setAttribute('href', '#contact');
        el.setAttribute('aria-disabled', 'true');
      }
    });

    // 备案号
    var icpEls = document.querySelectorAll('[data-icp]');
    Array.prototype.forEach.call(icpEls, function (el) {
      if (CFG.icp) {
        el.textContent = CFG.icp;
      } else {
        el.textContent = '备案信息待补充';
        el.classList.add('cfg-pending');
      }
    });

    if (!primary) {
      var pending = document.querySelectorAll('[data-pending]');
      Array.prototype.forEach.call(pending, function (el) {
        el.classList.add('cfg-pending');
      });
    }
  }


  /* ------------------------------------------------------------------
     2. 滚动进场（once: true，不反复播放）
     ------------------------------------------------------------------ */
  function initReveal() {
    var targets = document.querySelectorAll('[data-reveal]');
    if (reduce || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(targets, function (t) { t.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px' });
    Array.prototype.forEach.call(targets, function (t) { io.observe(t); });
  }

  /* ------------------------------------------------------------------
     3. 导航当前区块高亮（scrollspy）
        用一条位于视口上部的检测带判定当前 Section，避免滚动监听带来的抖动。
     ------------------------------------------------------------------ */
  function initScrollspy() {
    var links = document.querySelectorAll('.nav-desktop a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;

    var map = {};
    var sections = [];
    Array.prototype.forEach.call(links, function (a) {
      var id = a.getAttribute('href').slice(1);
      var sec = document.getElementById(id);
      if (sec) { map[id] = a; sections.push(sec); }
    });
    if (!sections.length) return;

    function setActive(id) {
      Object.keys(map).forEach(function (k) {
        map[k].classList.toggle('is-active', k === id);
      });
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) setActive(en.target.id);
      });
    }, { rootMargin: '-15% 0px -75% 0px', threshold: 0 });

    sections.forEach(function (s) { io.observe(s); });
  }

  /* ------------------------------------------------------------------
     4. 移动端全屏菜单
     ------------------------------------------------------------------ */
  function initMenu() {
    var menu = document.getElementById('mobileMenu');
    var openBtn = document.getElementById('menuOpen');
    var closeBtn = document.getElementById('menuClose');
    if (!menu || !openBtn || !closeBtn) return;

    function setMenu(open) {
      menu.classList.toggle('open', open);
      openBtn.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) { closeBtn.focus(); } else { openBtn.focus(); }
    }
    openBtn.addEventListener('click', function () { setMenu(true); });
    closeBtn.addEventListener('click', function () { setMenu(false); });
    Array.prototype.forEach.call(menu.querySelectorAll('a'), function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) setMenu(false);
    });
  }

  applyConfig();
  initReveal();
  initScrollspy();
  initMenu();
})();
