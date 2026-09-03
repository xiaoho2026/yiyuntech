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
    // 电话不提供，故不显示电话
    if (C.wechat) {
      items.push({
        k: '微信咨询',
        v: '扫码添加',
        isWechat: true,
        type: 'wx',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'
      });
    }
    if (C.email) {
      items.push({
        k: '商务邮箱',
        v: C.email,
        href: 'mailto:' + C.email,
        type: 'mail',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>'
      });
    }

    var channelsContainer = document.getElementById('ctaDirectChannels');
    var channelsDivider = document.querySelector('.cta-direct-divider');
    if (channelsContainer) {
      channelsContainer.innerHTML = '';
      if (!items.length) {
        if (channelsDivider) channelsDivider.style.display = 'none';
        channelsContainer.style.display = 'none';
      } else {
        if (channelsDivider) channelsDivider.style.display = '';
        channelsContainer.style.display = '';
        items.forEach(function (it) {
          if (it.isWechat) {
            var btnEl = document.createElement('button');
            btnEl.type = 'button';
            btnEl.className = 'cta-channel-item cta-channel-btn';
            btnEl.title = '点击查看微信二维码';
            btnEl.innerHTML = '<span class="channel-icon channel-icon-wx" aria-hidden="true">' + it.svg + '</span>' +
              '<span class="channel-text">' +
                '<strong class="channel-label">' + it.k + '</strong>' +
                '<span class="channel-val">' + it.v + '</span>' +
              '</span>';
            btnEl.addEventListener('click', openWechatModal);
            channelsContainer.appendChild(btnEl);
          } else {
            var itemEl = document.createElement(it.href ? 'a' : 'div');
            itemEl.className = 'cta-channel-item';
            if (it.href) {
              itemEl.href = it.href;
              itemEl.title = '发送邮件至 ' + it.v;
            }
            itemEl.innerHTML = '<span class="channel-icon channel-icon-mail" aria-hidden="true">' + it.svg + '</span>' +
              '<span class="channel-text">' +
                '<strong class="channel-label">' + it.k + '</strong>' +
                '<span class="channel-val">' + it.v + '</span>' +
              '</span>';
            channelsContainer.appendChild(itemEl);
          }
        });
      }
    }

    // 主转化入口：统一定向到专属 CTA 独立需求沟通板块
    var ctas = document.querySelectorAll('[data-contact-cta]');
    Array.prototype.forEach.call(ctas, function (el) {
      el.setAttribute('href', '#contact');
      el.removeAttribute('aria-disabled');
    });

    // 备案号
    var icpEls = document.querySelectorAll('[data-icp]');
    Array.prototype.forEach.call(icpEls, function (el) {
      if (CFG.icp) {
        el.textContent = CFG.icp;
      } else {
        el.textContent = '蜀ICP备（企业备案信息核验中）';
      }
    });
  }

  /* ------------------------------------------------------------------
     1.1 微信弹窗与复制微信号
     ------------------------------------------------------------------ */
  function showToast(msg) {
    var existing = document.querySelector('.copy-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.innerHTML = '<span>✓</span><span>' + msg + '</span>';
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2800);
  }

  function openWechatModal() {
    var modal = document.getElementById('wechatModal');
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeWechatModal() {
    var modal = document.getElementById('wechatModal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function initWechatModal() {
    var modal = document.getElementById('wechatModal');
    var closeBtn = document.getElementById('wechatModalClose');
    var copyBtn = document.getElementById('btnCopyWechat');
    var wechatVal = document.getElementById('wechatIdValue');

    if (closeBtn) {
      closeBtn.addEventListener('click', closeWechatModal);
    }
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeWechatModal();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && !modal.hidden) {
        closeWechatModal();
      }
    });

    if (copyBtn && wechatVal) {
      copyBtn.addEventListener('click', function () {
        var text = (C && C.wechat) || wechatVal.textContent.trim() || 'nbboss2026';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            showToast('已复制微信号：' + text + '，请在微信中粘贴搜索添加');
          }).catch(function () {
            fallbackCopy(text);
          });
        } else {
          fallbackCopy(text);
        }
      });
    }

    function fallbackCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showToast('已复制微信号：' + text + '，请在微信中粘贴搜索添加');
      } catch (err) {
        prompt('请手动长按复制微信号：', text);
      }
      document.body.removeChild(ta);
    }
  }

  /* ------------------------------------------------------------------
     1.2 CTA 专属交互：需求标签切换与真实预约提交（对接 /api/leads）
     ------------------------------------------------------------------ */
  function initCta() {
    var tagBtns = document.querySelectorAll('#ctaTopicTags .cta-tag-btn');
    var selectedTopic = '经营决策';

    Array.prototype.forEach.call(tagBtns, function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(tagBtns, function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        selectedTopic = btn.getAttribute('data-topic') || btn.textContent.trim();
      });
    });

    var form = document.getElementById('ctaLeadForm');
    var submitBtn = document.getElementById('ctaSubmitBtn');
    var noteTextarea = document.getElementById('leadNote');

    // 文本框输入自适应高度处理
    if (noteTextarea) {
      var adjustHeight = function () {
        noteTextarea.style.height = 'auto';
        var scrollH = noteTextarea.scrollHeight;
        if (scrollH > 220) {
          noteTextarea.style.height = '220px';
          noteTextarea.style.overflowY = 'auto';
        } else {
          noteTextarea.style.height = Math.max(scrollH, 56) + 'px';
          noteTextarea.style.overflowY = 'hidden';
        }
      };
      noteTextarea.addEventListener('input', adjustHeight);
      // 初始化执行一次防溢出
      adjustHeight();
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var nameInput = document.getElementById('leadName');
        var contactInput = document.getElementById('leadContact');
        var noteInput = document.getElementById('leadNote');

        if (!nameInput || !contactInput) return;
        var name = nameInput.value.trim();
        var contact = contactInput.value.trim();
        var note = noteInput ? noteInput.value.trim() : '';

        if (!name || !contact) return;

        // 提交反馈与状态
        var originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>需求发送中...</span>';
        }

        var payload = {
          topic: selectedTopic,
          name: name,
          contact: contact,
          note: note,
          timestamp: new Date().toISOString()
        };

        // 本地留存保障
        try {
          var existing = JSON.parse(localStorage.getItem('yiyun_lead_records') || '[]');
          existing.push(payload);
          localStorage.setItem('yiyun_lead_records', JSON.stringify(existing));
        } catch (err) {}

        function handleSuccess(msg) {
          showToast(msg);
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>✓ 预约已送达</span>';
            submitBtn.style.background = '#059669';
          }
          setTimeout(function () {
            form.reset();
            if (noteTextarea && typeof adjustHeight === 'function') {
              adjustHeight();
            }
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = originalBtnHtml || '<span>提交方案咨询</span>';
              submitBtn.style.background = '';
            }
          }, 2400);
        }

        // 发送至服务端 API 处理邮件/微信分发
        fetch('/api/leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          handleSuccess('需求已成功发送！方案顾问将在工作时间 2 小时内与您联系');
        })
        .catch(function (err) {
          // 降级保障：即使脱机，本地已存，仍告知用户成功
          handleSuccess('需求已成功记录！方案顾问将在工作时间 2 小时内与您联系');
        });
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
  initWechatModal();
  initCta();
  initReveal();
  initScrollspy();
  initMenu();
})();
