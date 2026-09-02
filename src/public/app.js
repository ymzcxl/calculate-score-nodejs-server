const app = document.getElementById('app');

const state = {
  token: localStorage.getItem('token') || '',
  user: JSON.parse(localStorage.getItem('userInfo') || 'null'),
  loginMode: 'login',
  socket: null,
  activeRoomId: '',
  room: null
};

const shortcuts = [1, 2, 5, 10, 20, 50];
const tapFeedback = () => {
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }
};

const toast = (message) => {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2200);
};

const closeSheet = () => {
  document.body.classList.remove('sheet-open');
  document.querySelector('.sheet-mask')?.remove();
};

const showSheet = ({
  title,
  description = '',
  fields = [],
  confirmText = '确定',
  cancelText = '取消',
  danger = false
}) => new Promise((resolve) => {
  closeSheet();

  const mask = document.createElement('div');
  mask.className = 'sheet-mask';
  mask.innerHTML = `
    <div class="sheet-card glass-card" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="sheet-handle"></div>
      <div class="sheet-title">${title}</div>
      ${description ? `<p class="sheet-desc">${description}</p>` : ''}
      <form class="sheet-form">
        <div class="sheet-fields"></div>
        <div class="sheet-actions">
          <button type="button" class="btn-secondary sheet-cancel">${cancelText}</button>
          <button type="submit" class="${danger ? 'btn-danger' : 'btn'}">${confirmText}</button>
        </div>
      </form>
    </div>
  `;

  const form = mask.querySelector('.sheet-form');
  const fieldsNode = mask.querySelector('.sheet-fields');
  const cleanup = (payload) => {
    closeSheet();
    resolve(payload);
  };

  fields.forEach((field) => {
    const wrap = document.createElement('label');
    wrap.className = 'sheet-field';
    wrap.innerHTML = field.label ? `<span>${field.label}</span>` : '';

    const input = document.createElement(field.multiline ? 'textarea' : 'input');
    input.className = field.multiline ? 'textarea' : 'field';
    input.name = field.name;
    input.placeholder = field.placeholder || '';
    input.value = field.value || '';
    input.autocomplete = field.autocomplete || 'off';
    input.inputMode = field.inputMode || '';
    input.maxLength = field.maxLength || 999;
    input.spellcheck = false;

    if (!field.multiline) {
      input.type = field.type || 'text';
    }

    wrap.appendChild(input);
    fieldsNode.appendChild(wrap);
  });

  mask.addEventListener('click', (event) => {
    if (event.target === mask) {
      cleanup(null);
    }
  });

  mask.querySelector('.sheet-cancel').addEventListener('click', () => cleanup(null));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    cleanup(payload);
  });

  document.body.appendChild(mask);
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => mask.classList.add('visible'));
  mask.querySelector('.field, .textarea')?.focus();
});

const confirmSheet = async (options) => Boolean(await showSheet({ ...options, fields: [] }));

const savePendingRoute = (hash) => {
  localStorage.setItem('pending_route', hash || '#/dashboard');
};

const consumePendingRoute = () => {
  const route = localStorage.getItem('pending_route') || '#/dashboard';
  localStorage.removeItem('pending_route');
  return route;
};

const setAuth = (payload) => {
  state.token = payload.token;
  state.user = payload.user;
  localStorage.setItem('token', payload.token);
  localStorage.setItem('userInfo', JSON.stringify(payload.user));
};

const clearAuth = () => {
  state.token = '';
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('userInfo');
};

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json();
  if (payload.code !== 200) {
    if (payload.code === 401) {
      savePendingRoute(location.hash || '#/dashboard');
      clearAuth();
      location.hash = '#/login';
    }
    throw new Error(payload.message || '请求失败');
  }

  return payload.data;
};

const parseRoute = () => {
  const hash = (location.hash || '#/dashboard').replace(/^#/, '');
  const [path, queryString = ''] = hash.split('?');
  return {
    path: path || '/dashboard',
    params: new URLSearchParams(queryString)
  };
};

const navigate = (path) => {
  location.hash = path;
};

const requireAuth = () => {
  if (!state.token) {
    savePendingRoute(location.hash || '#/dashboard');
    navigate('/login');
    return false;
  }
  return true;
};

const avatarText = (name) => (name || '?').slice(0, 1).toUpperCase();

const renderAuth = () => {
  app.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-layout">
        <section class="glass-card hero">
          <div class="hero-badge">实时在线记分</div>
          <div class="hero-kicker">Simple · Modern · Live</div>
          <h1 class="title">打牌时顺手记分，牌局里所有变化都会实时同步</h1>
          <p class="desc">这是面向手机竖屏的在线记分 H5：手机号登录、房间邀请、实时刷新、历史沉淀，打开链接就能直接开局。</p>
          <div class="grid-3 hero-metrics" style="margin-top:20px">
            <div class="metric"><div class="metric-label">打开方式</div><div class="metric-value">H5</div></div>
            <div class="metric"><div class="metric-label">同步状态</div><div class="metric-value">LIVE</div></div>
            <div class="metric"><div class="metric-label">数据记录</div><div class="metric-value">实时</div></div>
          </div>
          <div class="hero-preview hero-preview-elevated">
            <div class="hero-preview-row">
              <span>当前牌局</span>
              <strong>ROOM 6208</strong>
            </div>
            <div class="hero-preview-score">
              <div><span>当前领先</span><strong>+26</strong></div>
              <div><span>在线人数</span><strong>4</strong></div>
            </div>
            <div class="hero-preview-footer">
              <span class="status-dot"></span>
              <span>房间在线同步中</span>
            </div>
          </div>
        </section>
        <section class="glass-card panel">
          <div class="panel-title">${state.loginMode === 'login' ? '登录继续牌局' : state.loginMode === 'register' ? '注册新账号' : '找回密码'}</div>
          <p class="desc">${state.loginMode === 'forgot' ? '先用手机号和注册昵称完成校验，再设置新密码。' : '登录后会自动回到你刚才准备进入的页面。'}</p>
          <div class="tabs">
            <button class="tab ${state.loginMode === 'login' ? 'active' : ''}" data-mode="login">登录</button>
            <button class="tab ${state.loginMode === 'register' ? 'active' : ''}" data-mode="register">注册</button>
            <button class="tab ${state.loginMode === 'forgot' ? 'active' : ''}" data-mode="forgot">找回密码</button>
          </div>
          <form id="auth-form" class="form-grid">
            <input class="field" type="tel" inputmode="numeric" autocomplete="tel" name="phone" placeholder="请输入手机号" maxlength="11" />
            ${state.loginMode !== 'forgot' ? '<input class="field" type="password" autocomplete="current-password" name="password" placeholder="请输入密码" />' : ''}
            ${state.loginMode === 'register' ? '<input class="field" type="password" autocomplete="new-password" name="confirmPassword" placeholder="请确认密码" /><input class="field" autocomplete="nickname" name="nickName" placeholder="请输入昵称" />' : ''}
            ${state.loginMode === 'forgot' ? '<input class="field" autocomplete="nickname" name="nickName" placeholder="请输入注册昵称" /><input class="field" type="password" autocomplete="new-password" name="newPassword" placeholder="请输入新密码" /><input class="field" type="password" autocomplete="new-password" name="confirmPassword" placeholder="请确认新密码" />' : ''}
            <button class="btn" type="submit">${state.loginMode === 'login' ? '立即登录' : state.loginMode === 'register' ? '完成注册' : '重置密码'}</button>
          </form>
        </section>
      </div>
    </div>
  `;

  app.querySelectorAll('.tab').forEach((node) => {
    node.addEventListener('click', () => {
      state.loginMode = node.dataset.mode;
      render();
    });
  });

  app.querySelector('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      if (state.loginMode === 'login') {
        const data = await api('/api/auth/phone', { method: 'POST', body: payload });
        setAuth(data);
        navigate(consumePendingRoute().replace(/^#/, ''));
        return;
      }

      if (state.loginMode === 'register') {
        const data = await api('/api/auth/register', { method: 'POST', body: payload });
        setAuth(data);
        navigate(consumePendingRoute().replace(/^#/, ''));
        return;
      }

      await api('/api/auth/reset-password', {
        method: 'POST',
        body: {
          phone: payload.phone,
          nickName: payload.nickName,
          newPassword: payload.newPassword,
          confirmPassword: payload.confirmPassword
        }
      });
      toast('密码已重置，请重新登录');
      state.loginMode = 'login';
      render();
    } catch (error) {
      toast(error.message);
    }
  });
};

const renderDashboard = async () => {
  if (!requireAuth()) {
    return;
  }

  const [profile, stats] = await Promise.all([
    api('/api/user/info'),
    api('/api/history/stats')
  ]);
  state.user = profile;
  localStorage.setItem('userInfo', JSON.stringify(profile));

  app.innerHTML = `
    <div class="app-shell dashboard">
      <section class="glass-card profile-card">
        <div class="profile-main">
          <div class="avatar">${avatarText(profile.nickName)}</div>
          <div>
            <div class="row"><strong style="font-size:28px">${profile.nickName}</strong><span class="badge">UID ${profile.uid}</span></div>
            <p class="desc" style="margin:8px 0 0">${profile.phone || '--'}</p>
          </div>
        </div>
        <div class="inline-actions action-grid">
          <button class="btn-secondary" id="edit-name">修改昵称</button>
          <button class="btn-secondary" id="change-password">修改密码</button>
          <button class="btn-secondary" id="go-history">历史战绩</button>
          <button class="btn-danger" id="logout">退出登录</button>
        </div>
      </section>

      <section class="stats-grid">
        <div class="glass-card stat"><div class="stat-label">总场次</div><div class="stat-value">${stats.totalGames}</div></div>
        <div class="glass-card stat"><div class="stat-label">胜率</div><div class="stat-value">${stats.winRate}%</div></div>
        <div class="glass-card stat"><div class="stat-label">累计积分</div><div class="stat-value">${stats.totalScore}</div></div>
      </section>

      <section class="glass-card panel">
        <div class="section-head">
          <div>
            <div class="panel-title">开局工作台</div>
            <p class="desc">创建房间后可以直接发链接邀请，也可以输入房间号快速加入。</p>
          </div>
          <span class="badge">实时在线</span>
        </div>
        <div class="btn-row" style="margin-top:18px">
          <button class="btn" id="create-room">创建实时房间</button>
        </div>
        <div class="join-box stack">
          <input id="join-input" class="field" inputmode="text" autocapitalize="characters" placeholder="输入房间号，或粘贴房间链接" />
          <div class="btn-row action-grid">
            <button class="btn-secondary" id="join-room">加入房间</button>
            <button class="btn-secondary" id="paste-link">粘贴剪贴板</button>
          </div>
        </div>
      </section>

      <section class="glass-card panel">
        <div class="section-head">
          <div class="panel-title">数据总览</div>
          <span class="subtle">自动累计</span>
        </div>
        <div class="analytics-grid" style="margin-top:18px">
          <div class="metric"><div class="metric-label">胜场</div><div class="metric-value">${stats.winGames}</div></div>
          <div class="metric"><div class="metric-label">平均得分</div><div class="metric-value">${stats.averageScore}</div></div>
          <div class="metric"><div class="metric-label">单局最佳</div><div class="metric-value">${stats.bestScore}</div></div>
        </div>
      </section>
    </div>
  `;

  const extractRoomId = (value) => {
    const match = (value || '').trim().match(/roomId=([A-Za-z0-9]+)/i);
    return (match?.[1] || value || '').trim().toUpperCase();
  };

  app.querySelector('#create-room').addEventListener('click', async () => {
    try {
      const room = await api('/api/room/create', { method: 'POST', body: {} });
      navigate(`/room?roomId=${room.roomId}&isCreator=1`);
    } catch (error) {
      toast(error.message);
    }
  });

  app.querySelector('#join-room').addEventListener('click', async () => {
    const input = app.querySelector('#join-input').value;
    const roomId = extractRoomId(input);
    if (!roomId) {
      toast('请输入房间号或房间链接');
      return;
    }
    try {
      await api('/api/room/join', { method: 'POST', body: { roomId } });
      navigate(`/room?roomId=${roomId}`);
    } catch (error) {
      toast(error.message);
    }
  });

  app.querySelector('#paste-link').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      app.querySelector('#join-input').value = text;
    } catch (error) {
      toast('读取剪贴板失败');
    }
  });

  app.querySelector('#go-history').addEventListener('click', () => navigate('/history'));
  app.querySelector('#logout').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => null);
    clearAuth();
    savePendingRoute('#/dashboard');
    navigate('/login');
  });

  app.querySelector('#edit-name').addEventListener('click', async () => {
    const result = await showSheet({
      title: '修改昵称',
      description: '昵称会显示在首页、房间和历史记录里。',
      confirmText: '保存',
      fields: [
        {
          name: 'nickName',
          label: '新昵称',
          value: profile.nickName,
          placeholder: '请输入新昵称',
          autocomplete: 'nickname',
          maxLength: 20
        }
      ]
    });
    const next = result?.nickName?.trim();
    if (!next) return;
    try {
      await api('/api/user/update', { method: 'POST', body: { nickName: next } });
      toast('昵称已更新');
      render();
    } catch (error) {
      toast(error.message);
    }
  });

  app.querySelector('#change-password').addEventListener('click', async () => {
    const result = await showSheet({
      title: '修改密码',
      description: '为了安全起见，需要先输入当前密码。',
      confirmText: '确认修改',
      fields: [
        { name: 'oldPassword', label: '当前密码', type: 'password', placeholder: '请输入当前密码', autocomplete: 'current-password' },
        { name: 'newPassword', label: '新密码', type: 'password', placeholder: '请输入新密码', autocomplete: 'new-password' },
        { name: 'confirmPassword', label: '确认新密码', type: 'password', placeholder: '请再次输入新密码', autocomplete: 'new-password' }
      ]
    });
    if (!result) return;
    const { oldPassword, newPassword, confirmPassword } = result;
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: { oldPassword, newPassword, confirmPassword }
      });
      toast('密码已修改');
    } catch (error) {
      toast(error.message);
    }
  });
};

const renderHistory = async () => {
  if (!requireAuth()) {
    return;
  }

  const [stats, history] = await Promise.all([
    api('/api/history/stats'),
    api('/api/history/list')
  ]);

  app.innerHTML = `
    <div class="app-shell dashboard">
      <section class="glass-card panel">
        <div class="between">
          <div>
            <div class="panel-title">历史战绩</div>
            <p class="desc">所有已结算对局都会自动沉淀在这里。</p>
          </div>
          <div class="inline-actions action-grid">
            <button class="btn-secondary" id="back-dashboard">返回首页</button>
            <button class="btn-danger" id="clear-history">清空历史</button>
          </div>
        </div>
        <div class="stats-grid" style="margin-top:18px">
          <div class="stat"><div class="stat-label">总场次</div><div class="stat-value">${stats.totalGames}</div></div>
          <div class="stat"><div class="stat-label">胜率</div><div class="stat-value">${stats.winRate}%</div></div>
          <div class="stat"><div class="stat-label">累计积分</div><div class="stat-value">${stats.totalScore}</div></div>
        </div>
      </section>
      <section class="glass-card panel">
        <div class="section-head">
          <div class="panel-title">对局列表</div>
          <span class="subtle">${history.length} 条记录</span>
        </div>
        ${history.length ? `<div class="history-list">${history.map((item) => `
          <div class="history-item">
            <div class="between history-head">
              <div>
                <strong>${item.roomTitle}</strong>
                <div class="subtle" style="margin-top:8px">${item.time} · 房间 ${item.roomId}</div>
              </div>
              <span class="badge">${item.result === 'win' ? '胜' : item.result === 'lose' ? '负' : '平'}</span>
            </div>
            <div class="grid-2" style="margin-top:14px">
              <div class="metric"><div class="metric-label">排名</div><div class="metric-value">#${item.rank}</div></div>
              <div class="metric"><div class="metric-label">积分</div><div class="metric-value">${item.score}</div></div>
            </div>
            <div class="subtle" style="margin-top:12px">对手：${item.opponents.join('、') || '--'}</div>
          </div>
        `).join('')}</div>` : '<div class="empty">还没有已结算的对局，先去创建一个房间吧。</div>'}
      </section>
    </div>
  `;

  app.querySelector('#back-dashboard').addEventListener('click', () => navigate('/dashboard'));
  app.querySelector('#clear-history').addEventListener('click', async () => {
    const confirmed = await confirmSheet({
      title: '清空历史战绩',
      description: '这个操作只会清空当前账号的历史记录，执行后无法撤回。',
      confirmText: '确认清空',
      danger: true
    });
    if (!confirmed) return;
    try {
      await api('/api/history/clear', { method: 'POST', body: {} });
      toast('历史已清空');
      render();
    } catch (error) {
      toast(error.message);
    }
  });
};

const disconnectSocket = () => {
  if (state.socket) {
    try {
      state.socket.emit('leave-room', state.activeRoomId);
      state.socket.disconnect();
    } catch (error) {
      console.error(error);
    }
  }
  state.socket = null;
  state.activeRoomId = '';
};

const syncRoom = async (roomId) => {
  const [room, scoreHistory, messages] = await Promise.all([
    api(`/api/room/info?roomId=${encodeURIComponent(roomId)}`),
    api(`/api/score/history?roomId=${encodeURIComponent(roomId)}`),
    api(`/api/message/history?roomId=${encodeURIComponent(roomId)}`)
  ]);

  state.room = {
    ...state.room,
    roomId,
    info: room,
    players: room.players || [],
    scoreHistory,
    messages
  };

  if (!state.room.selectedTargetId) {
    const target = state.room.players.find((item) => item.userId !== state.user.uid);
    state.room.selectedTargetId = target?.userId || '';
  }
};

const ensureSocket = (roomId) => {
  if (state.socket && state.activeRoomId === roomId) {
    return;
  }

  disconnectSocket();
  state.activeRoomId = roomId;
  state.socket = io();
  state.socket.on('connect', () => {
    state.socket.emit('join-room', roomId);
  });
  ['player-joined', 'player-left', 'score-updated', 'new-message', 'room-settled'].forEach((eventName) => {
    state.socket.on(eventName, async () => {
      await syncRoom(roomId);
      renderRoom();
    });
  });
};

const renderRoom = async () => {
  const { params } = parseRoute();
  const roomId = (params.get('roomId') || '').toUpperCase();
  const isCreator = params.get('isCreator') === '1';
  if (!roomId) {
    toast('房间号缺失');
    navigate('/dashboard');
    return;
  }
  if (!requireAuth()) {
    return;
  }

  try {
    if (!state.room || state.room.roomId !== roomId) {
      if (!isCreator) {
        await api('/api/room/join', { method: 'POST', body: { roomId } });
      }
      state.room = {
        roomId,
        isCreator,
        selectedTargetId: ''
      };
    }

    await syncRoom(roomId);
    ensureSocket(roomId);
  } catch (error) {
    toast(error.message);
    navigate('/dashboard');
    return;
  }

  const room = state.room.info;
  const players = [...state.room.players].sort((a, b) => b.score - a.score);
  const currentUserId = state.user.uid;
  const targetId = state.room.selectedTargetId;
  const selectedName = state.room.players.find((item) => item.userId === targetId)?.name || '请选择一位玩家';
  const shareLink = `${location.origin}${location.pathname}#/room?roomId=${roomId}`;

  app.innerHTML = `
    <div class="app-shell stack">
      <section class="glass-card panel">
        <div class="between">
          <div>
            <div class="panel-title">${room.title || '实时牌局'}</div>
            <p class="desc">房间号 ${roomId} · ${room.status === 'active' ? '牌局进行中' : '本局已结束'}</p>
          </div>
          <div class="inline-actions room-status-pills">
            <span class="badge">${players.length} 人</span>
            <span class="badge">${isCreator ? '房主' : '在线中'}</span>
          </div>
        </div>
        <div class="metric" style="margin-top:18px">
          <div class="metric-label">邀请链接</div>
          <div class="subtle" style="margin-top:10px;word-break:break-all">${shareLink}</div>
          <div class="btn-row action-grid" style="margin-top:14px">
            <button class="btn-secondary" id="copy-link">复制链接</button>
            ${isCreator && room.status === 'active' ? '<button class="btn-secondary" id="settle-room">结束对局</button>' : ''}
            ${room.status === 'active' ? '<button class="btn-secondary" id="revoke-score">撤回上一笔</button>' : ''}
            <button class="${isCreator ? 'btn-danger' : 'btn-secondary'}" id="exit-room">${isCreator ? '关闭并退出' : '退出房间'}</button>
            <button class="btn-secondary" id="back-home">返回首页</button>
          </div>
        </div>
      </section>

      <div class="room-layout">
        <section class="glass-card">
          <div class="section-head">
            <div class="panel-title">玩家总分</div>
            <span class="subtle">点选记分目标</span>
          </div>
          <p class="desc">点其他玩家给他记分，点自己的卡片可以修改当前房间昵称。</p>
          <div class="player-list">
            ${players.map((player) => `
              <div class="player-card ${targetId === player.userId ? 'active' : ''}" data-player-id="${player.userId}">
                <div class="player-top">
                  <strong>${player.name}${player.userId === currentUserId ? ' · 我' : ''}</strong>
                  ${player.userId === currentUserId ? '<button class="btn-secondary edit-player-name">改名</button>' : ''}
                </div>
                <div class="score">${player.score > 0 ? `+${player.score}` : player.score}</div>
              </div>
            `).join('')}
          </div>
        </section>

        <section class="stack">
          ${room.status === 'active' ? `
          <section class="glass-card">
            <div class="section-head">
              <div class="panel-title">快捷记分</div>
              <span class="subtle">快速加分</span>
            </div>
            <p class="desc">当前操作者：${state.room.players.find((item) => item.userId === currentUserId)?.name || '我'}，当前目标：${selectedName}</p>
            <div class="shortcuts">
              ${shortcuts.map((item) => `<button class="shortcut" data-score="${item}">+${item}</button>`).join('')}
            </div>
            <div class="btn-row input-action-row" style="margin-top:16px">
              <input id="custom-score" class="field" type="tel" inputmode="numeric" placeholder="输入自定义分数" />
              <button class="btn" id="custom-submit">记分</button>
            </div>
          </section>` : ''}

          <section class="glass-card">
            <div class="section-head">
              <div class="panel-title">记分流水</div>
              <span class="subtle">${state.room.scoreHistory.length} 笔</span>
            </div>
            ${state.room.scoreHistory.length ? `
              <div class="timeline-list">
                ${state.room.scoreHistory.map((item) => {
                  const fromName = state.room.players.find((player) => player.userId === item.fromUserId)?.name || '玩家';
                  const toName = state.room.players.find((player) => player.userId === item.toUserId)?.name || '玩家';
                  return `
                    <div class="timeline-item">
                      <div><strong>${fromName} -> ${toName} ${item.score} 分</strong></div>
                      <div class="subtle">${item.isRevoked ? '该记录已撤回' : `结算后比分：${item.fromUserScoreAfter} / ${item.toUserScoreAfter}`}</div>
                      <div class="subtle">${new Date(item.timestamp).toLocaleString('zh-CN')}</div>
                    </div>
                  `;
                }).join('')}
              </div>` : '<div class="empty">还没有记分流水。</div>'}
          </section>

          <section class="glass-card">
            <div class="section-head">
              <div class="panel-title">房间消息</div>
              <span class="subtle">${state.room.messages.length} 条</span>
            </div>
            ${state.room.messages.length ? `
              <div class="message-list">
                ${state.room.messages.map((item) => `
                  <div class="message-item">
                    <div><strong>${item.userName || '系统'}</strong></div>
                    <div style="margin-top:8px">${item.content}</div>
                    <div class="subtle" style="margin-top:10px">${new Date(item.timestamp).toLocaleString('zh-CN')}</div>
                  </div>
                `).join('')}
              </div>` : '<div class="empty">还没有消息记录。</div>'}
            ${room.status === 'active' ? `
              <div class="btn-row input-action-row" style="margin-top:16px">
                <input id="message-input" class="field" placeholder="说点什么，房间内所有人都能看到" />
                <button class="btn-secondary" id="send-message">发送</button>
              </div>` : ''}
          </section>
        </section>
      </div>
    </div>
  `;

  app.querySelector('#back-home').addEventListener('click', () => navigate('/dashboard'));
  app.querySelector('#copy-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      tapFeedback();
      toast('链接已复制');
    } catch (error) {
      toast('复制失败');
    }
  });

  app.querySelectorAll('[data-player-id]').forEach((node) => {
    node.addEventListener('click', async () => {
      const userId = node.dataset.playerId;
      if (userId === currentUserId) return;
      tapFeedback();
      state.room.selectedTargetId = userId;
      renderRoom();
    });
  });

  app.querySelectorAll('.edit-player-name').forEach((node) => {
    node.addEventListener('click', async (event) => {
      event.stopPropagation();
      const currentName = state.room.players.find((item) => item.userId === currentUserId)?.name || '';
      const result = await showSheet({
        title: '修改房间昵称',
        description: '这个昵称只影响当前房间内的显示。',
        confirmText: '保存昵称',
        fields: [
          {
            name: 'name',
            label: '房间昵称',
            value: currentName,
            placeholder: '请输入当前房间里的昵称',
            autocomplete: 'nickname',
            maxLength: 20
          }
        ]
      });
      const next = result?.name?.trim();
      if (!next) return;
      try {
        await api('/api/room/player-name', { method: 'POST', body: { roomId, name: next } });
        await syncRoom(roomId);
        state.socket?.emit('player-joined', { roomId });
        renderRoom();
      } catch (error) {
        toast(error.message);
      }
    });
  });

  if (room.status === 'active') {
    app.querySelectorAll('[data-score]').forEach((node) => {
      node.addEventListener('click', async () => {
        if (!state.room.selectedTargetId) {
          toast('请先选择一位玩家');
          return;
        }
        try {
          tapFeedback();
          await api('/api/score/update', {
            method: 'POST',
            body: {
              roomId,
              fromUserId: currentUserId,
              toUserId: state.room.selectedTargetId,
              score: Number(node.dataset.score)
            }
          });
          state.socket?.emit('score-updated', { roomId });
          await syncRoom(roomId);
          renderRoom();
        } catch (error) {
          toast(error.message);
        }
      });
    });

    app.querySelector('#custom-submit')?.addEventListener('click', async () => {
      const score = Number(app.querySelector('#custom-score').value);
      if (!score || score <= 0) {
        toast('请输入正整数分值');
        return;
      }
      if (!state.room.selectedTargetId) {
        toast('请先选择一位玩家');
        return;
      }
      try {
        tapFeedback();
        await api('/api/score/update', {
          method: 'POST',
          body: {
            roomId,
            fromUserId: currentUserId,
            toUserId: state.room.selectedTargetId,
            score
          }
        });
        state.socket?.emit('score-updated', { roomId });
        await syncRoom(roomId);
        renderRoom();
      } catch (error) {
        toast(error.message);
      }
    });

    app.querySelector('#send-message')?.addEventListener('click', async () => {
      const content = app.querySelector('#message-input').value.trim();
      if (!content) return;
      try {
        await api('/api/message/send', { method: 'POST', body: { roomId, content, type: 'user' } });
        state.socket?.emit('new-message', { roomId });
        await syncRoom(roomId);
        renderRoom();
      } catch (error) {
        toast(error.message);
      }
    });
  }

  app.querySelector('#revoke-score')?.addEventListener('click', async () => {
    tapFeedback();
    try {
      await api('/api/score/revoke', { method: 'POST', body: { roomId } });
      state.socket?.emit('score-updated', { roomId });
      await syncRoom(roomId);
      renderRoom();
    } catch (error) {
      toast(error.message);
    }
  });

  app.querySelector('#settle-room')?.addEventListener('click', async () => {
    const confirmed = await confirmSheet({
      title: '结束对局',
      description: '结束后会生成本局结算，并同步写入每位玩家的历史记录。',
      confirmText: '确认结束'
    });
    if (!confirmed) return;
    try {
      const data = await api('/api/room/settle', { method: 'POST', body: { roomId } });
      state.socket?.emit('room-settled', { roomId, rankings: data.rankings });
      await syncRoom(roomId);
      renderRoom();
    } catch (error) {
      toast(error.message);
    }
  });

  app.querySelector('#exit-room').addEventListener('click', async () => {
    const confirmed = await confirmSheet({
      title: isCreator ? '关闭并退出房间' : '退出当前房间',
      description: isCreator
        ? '关闭后这个房间将不能继续记分，其他玩家也会结束当前牌局。'
        : '退出后你可以通过链接或房间号重新加入。',
      confirmText: isCreator ? '确认关闭' : '确认退出',
      danger: isCreator
    });
    if (!confirmed) return;
    try {
      if (isCreator) {
        await api('/api/room/close', { method: 'POST', body: { roomId } });
      } else {
        await api('/api/room/exit', { method: 'POST', body: { roomId } });
      }
      disconnectSocket();
      navigate('/dashboard');
    } catch (error) {
      toast(error.message);
    }
  });
};

const render = async () => {
  const { path } = parseRoute();
  try {
    if (path !== '/room') {
      disconnectSocket();
      state.room = null;
    }

    if (path === '/login') {
      renderAuth();
      return;
    }

    if (path === '/history') {
      await renderHistory();
      return;
    }

    if (path === '/room') {
      await renderRoom();
      return;
    }

    await renderDashboard();
  } catch (error) {
    toast(error.message || '加载失败');
  }
};

window.addEventListener('hashchange', render);
window.addEventListener('beforeunload', disconnectSocket);

if (!location.hash) {
  location.hash = state.token ? '#/dashboard' : '#/login';
} else {
  render();
}
