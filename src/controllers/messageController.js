const Message = require('../models/Message');
const Player = require('../models/Player');
const Room = require('../models/Room');

const mapMessage = (message, userName = '玩家', extra = {}) => ({
  messageId: message._id,
  userId: message.userId,
  userName,
  content: message.content,
  targetUserId: message.targetUserId || '',
  targetScope: message.targetUserId ? 'player' : 'room',
  type: message.type,
  timestamp: message.timestamp,
  ...extra
});

const emitRoomEvent = (req, eventName, payload) => {
  const io = req.app.get('io');
  if (!io || !payload?.roomId) {
    return;
  }

  io.to(payload.roomId).emit(eventName, payload);
};

const getActiveRoomAndSender = async (roomId, uid) => {
  const room = await Room.findOne({ roomId, status: 'active' });
  if (!room) {
    const error = new Error('房间不存在或已结束');
    error.statusCode = 404;
    throw error;
  }

  const sender = await Player.findOne({ roomId, userId: uid });
  if (!sender) {
    const error = new Error('您不在当前房间中');
    error.statusCode = 403;
    throw error;
  }

  return { room, sender };
};

const LEADERBOARD_NOTICE_TEMPLATES = {
  tie: [
    ({ leaderNames, leaderScore }) => `全桌快看，${leaderNames} 正并列领跑，都是 ${leaderScore} 分，这把还远没定。`,
    ({ leaderNames, leaderScore }) => `牌桌前排暂时挤满了，${leaderNames} 一起站上 ${leaderScore} 分，谁都别先开香槟。`,
    ({ leaderNames, leaderScore }) => `领先位现在有点热闹，${leaderNames} 同分压线，分数都是 ${leaderScore}。`
  ],
  soloClose: [
    ({ leaderNames, leaderScore, gapText }) => `全桌注意，${leaderNames} 暂时坐在前排，${leaderScore} 分，${gapText}，可以盯紧了。`,
    ({ leaderNames, leaderScore, gapText }) => `风向刚有点变化，${leaderNames} 先冒头到 ${leaderScore} 分，${gapText}，追一手正合适。`,
    ({ leaderNames, leaderScore, gapText }) => `${leaderNames} 刚把领先位暖热，当前 ${leaderScore} 分，${gapText}，桌上还很有悬念。`
  ],
  soloSteady: [
    ({ leaderNames, leaderScore, gapText }) => `牌桌广播，${leaderNames} 正稳稳领跑，来到 ${leaderScore} 分，${gapText}，大家可以多看两眼。`,
    ({ leaderNames, leaderScore, gapText }) => `提醒全桌，${leaderNames} 已经把节奏带起来了，${leaderScore} 分，${gapText}。`,
    ({ leaderNames, leaderScore, gapText }) => `现在最该被关注的是 ${leaderNames}，分数 ${leaderScore}，${gapText}，别让他一路轻松到底。`
  ],
  soloRunaway: [
    ({ leaderNames, leaderScore, gapText }) => `全桌聚光灯先打给 ${leaderNames}，已经冲到 ${leaderScore} 分，${gapText}，该上点压力了。`,
    ({ leaderNames, leaderScore, gapText }) => `前方出现明显领先者，${leaderNames} 把分数抬到 ${leaderScore}，${gapText}，大家记得重点照顾。`,
    ({ leaderNames, leaderScore, gapText }) => `牌桌雷达提示，${leaderNames} 正在大步领跑，${leaderScore} 分，${gapText}，这波存在感很强。`
  ],
  soloOnly: [
    ({ leaderNames, leaderScore }) => `目前桌上只有 ${leaderNames} 先把领先位坐住了，分数 ${leaderScore}。`,
    ({ leaderNames, leaderScore }) => `${leaderNames} 先占上了头名位置，当前 ${leaderScore} 分，后续谁来接招。`
  ]
};

const pickTemplateBySeed = (templates, seed) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) >>> 0;
  }

  return templates[hash % templates.length];
};

const formatSignedScore = (score) => (score > 0 ? `+${score}` : `${score}`);

const buildLeadGapText = (leadGap) => {
  if (!Number.isFinite(leadGap) || leadGap <= 0) {
    return '';
  }

  return `领先第 2 名 ${leadGap} 分`;
};

const buildLeaderboardNoticeEffectMeta = ({ leaders, leaderScore, runnerUpScore, leadGap }) => {
  const variant = leaders.length > 1
    ? 'tie-race'
    : !Number.isFinite(runnerUpScore)
      ? 'solo-leader'
      : leadGap >= 30
        ? 'solo-runaway'
        : leadGap >= 10
          ? 'solo-steady'
          : 'solo-close';

  const emphasis = leaders.length > 1 ? 'medium' : leadGap >= 30 ? 'strong' : 'medium';

  return {
    scene: 'leaderboard-notice',
    scope: 'room',
    variant,
    emphasis,
    motion: leaders.length > 1 ? 'pulse' : leadGap >= 30 ? 'spotlight' : 'flash',
    durationMs: 2200,
    leaderCount: leaders.length,
    leaderScore
  };
};

const pickLeaderboardNoticeContent = ({ leaders, leaderScore, runnerUpScore }) => {
  const leaderNames = leaders.map((player) => player.name).join('、');
  const normalizedScore = formatSignedScore(leaderScore);
  const leadGap = Number.isFinite(runnerUpScore) ? leaderScore - runnerUpScore : NaN;
  const gapText = buildLeadGapText(leadGap);
  const seed = `${leaderNames}|${leaderScore}|${runnerUpScore}|${leaders.length}`;

  if (leaders.length > 1) {
    const template = pickTemplateBySeed(LEADERBOARD_NOTICE_TEMPLATES.tie, seed);
    return {
      content: template({ leaderNames, leaderScore: normalizedScore }),
      effectMeta: buildLeaderboardNoticeEffectMeta({ leaders, leaderScore, runnerUpScore, leadGap }),
      leadGap: 0
    };
  }

  if (!Number.isFinite(runnerUpScore)) {
    const template = pickTemplateBySeed(LEADERBOARD_NOTICE_TEMPLATES.soloOnly, seed);
    return {
      content: template({ leaderNames, leaderScore: normalizedScore }),
      effectMeta: buildLeaderboardNoticeEffectMeta({ leaders, leaderScore, runnerUpScore, leadGap }),
      leadGap: null
    };
  }

  const templateGroup = leadGap >= 30
    ? LEADERBOARD_NOTICE_TEMPLATES.soloRunaway
    : leadGap >= 10
      ? LEADERBOARD_NOTICE_TEMPLATES.soloSteady
      : LEADERBOARD_NOTICE_TEMPLATES.soloClose;
  const template = pickTemplateBySeed(templateGroup, seed);

  return {
    content: template({ leaderNames, leaderScore: normalizedScore, gapText }),
    effectMeta: buildLeaderboardNoticeEffectMeta({ leaders, leaderScore, runnerUpScore, leadGap }),
    leadGap
  };
};

// 发送消息
exports.sendMessage = async (req, res) => {
  try {
    const { roomId, content, type, targetUserId = '' } = req.body;
    const { uid } = req.user;
    const trimmedContent = String(content || '').trim();
    const normalizedTargetUserId = String(targetUserId || '').trim();

    if (!roomId || !trimmedContent) {
      return res.status(400).json({
        code: 400,
        message: '房间号和消息内容不能为空'
      });
    }
    
    // 验证消息类型
    if (!['user', 'system'].includes(type)) {
      return res.status(400).json({
        code: 400,
        message: '消息类型无效'
      });
    }

    const { sender } = await getActiveRoomAndSender(roomId, uid);

    if (normalizedTargetUserId && normalizedTargetUserId !== uid) {
      const targetPlayer = await Player.findOne({ roomId, userId: normalizedTargetUserId });
      if (!targetPlayer) {
        return res.status(404).json({
          code: 404,
          message: '目标玩家不存在'
        });
      }
    }
    
    // 创建消息
    const message = new Message({
      roomId,
      userId: uid,
      content: trimmedContent,
      targetUserId: normalizedTargetUserId,
      type
    });
    await message.save();

    res.json({
      code: 200,
      data: mapMessage(message, sender.name || '玩家'),
      message: '消息发送成功'
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      code: error.statusCode || 500,
      message: error.message || '消息发送失败'
    });
  }
};

exports.sendLeaderboardNotice = async (req, res) => {
  try {
    const { roomId } = req.body;
    const { uid } = req.user;

    if (!roomId) {
      return res.status(400).json({
        code: 400,
        message: '缺少房间号'
      });
    }

    const { sender } = await getActiveRoomAndSender(roomId, uid);
    const players = await Player.find({ roomId }).sort({ score: -1, joinedAt: 1, _id: 1 });

    if (!players.length) {
      return res.status(400).json({
        code: 400,
        message: '当前房间暂无玩家'
      });
    }

    const leaderScore = players[0].score;
    const leaders = players
      .filter((player) => player.score === leaderScore)
      .map((player) => ({
        userId: player.userId,
        name: player.name,
        avatar: player.avatar || '',
        score: player.score
      }));

    const runnerUpScore = leaders.length === players.length ? NaN : players[leaders.length]?.score;
    const notice = pickLeaderboardNoticeContent({ leaders, leaderScore, runnerUpScore });

    const message = await Message.create({
      roomId,
      userId: uid,
      content: notice.content,
      targetUserId: '',
      type: 'system'
    });

    const payload = mapMessage(message, sender.name || '玩家', {
      noticeType: 'leaderboard',
      initiatorUserId: uid,
      leaders,
      leaderScore,
      runnerUpScore: Number.isFinite(runnerUpScore) ? runnerUpScore : null,
      leadGap: Number.isFinite(notice.leadGap) ? notice.leadGap : null,
      effectMeta: notice.effectMeta
    });

    emitRoomEvent(req, 'leaderboard-notice', payload);
    emitRoomEvent(req, 'new-message', payload);

    res.json({
      code: 200,
      data: payload,
      message: '排行榜通知已发送'
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      code: error.statusCode || 500,
      message: error.message || '发送排行榜通知失败'
    });
  }
};

// 获取消息记录
exports.getMessageHistory = async (req, res) => {
  try {
    const { roomId, limit = 50, offset = 0 } = req.query;
    
    // 获取消息记录
    const messages = await Message.find({ roomId })
      .sort({ timestamp: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));
    
    const players = await Player.find({ roomId, userId: { $in: messages.map(item => item.userId) } });
    const playerMap = new Map(players.map(item => [item.userId, item.name]));

    res.json({
      code: 200,
      data: messages.map(msg => mapMessage(msg, playerMap.get(msg.userId) || '玩家')),
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取失败'
    });
  }
};
