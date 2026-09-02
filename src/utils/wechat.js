const WECHAT_API = 'https://api.weixin.qq.com/sns/jscode2session';

const createConfigError = (message) => {
  const error = new Error(message);
  error.statusCode = 500;
  return error;
};

const createAuthError = (message) => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

const getWechatConfig = () => {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;

  if (!appId || !appSecret) {
    throw createConfigError('微信登录未配置，请设置 WECHAT_APP_ID 和 WECHAT_APP_SECRET');
  }

  return { appId, appSecret };
};

exports.resolveWechatSession = async (code) => {
  if (!code) {
    throw createAuthError('缺少微信登录 code');
  }

  const { appId, appSecret } = getWechatConfig();
  const search = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    js_code: code,
    grant_type: 'authorization_code'
  });

  const response = await fetch(`${WECHAT_API}?${search.toString()}`);
  if (!response.ok) {
    throw createAuthError('微信服务请求失败，请稍后重试');
  }

  const payload = await response.json();
  if (payload.errcode || !payload.openid) {
    throw createAuthError(payload.errmsg || '微信登录校验失败');
  }

  return {
    openId: payload.openid,
    unionId: payload.unionid || ''
  };
};
