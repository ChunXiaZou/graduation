import Router from 'koa-router';
import UserService from '../services/UserService';
import QaService from "../services/QaService";
import TagService from "../services/TagService";
import CommentService from '../services/CommentService'

import koaJwt from 'koa-jwt'
import cfg from '../config'
// rest接口, 提供前端api
const router = new Router({ prefix: '/api'});
export default router;

// 问题列表 TODO: 标签类型
router.get('/q/list', async (ctx) => {
  let limit = ctx.query.limit || 3;
  let [questions, count] = await QaService.getQuestions({
    page: ctx.query.page,
    limit: limit,
    sort: ctx.query.sort,
    fields: {tags: 1, answerNum: 1, views: 1, title: 1, author: 1, updatedAt: 1, createdAt: 1, like: 1, hate: 1}
  });
  ctx.body = { 
    questions: questions, 
    page: {
      currPage: +ctx.query.page || 1,
      pageNum: Math.ceil(count / limit),
      count: count
    }
  }
});

// 推荐问题
router.get('/q/recommends', async (ctx) => {
  ctx.body =  await QaService.getRecommendQuestions();
});

// 获取问题和所属的答案
router.get('/question/:id', async (ctx) => {
  let q = await QaService.getQuestionById(ctx.params.id);
  let [question, answers] =await Promise.all([
    QaService.getQuestionById(ctx.params.id),
    QaService.getAnswersByQuestion(ctx.params.id)
  ]);
  // console.info(question);
  console.log(answers);
  ctx.body = {question: question, answers: answers};
});

// 获取所有标签
router.get('/tags', async (ctx) => {
  ctx.body = await TagService.getTags();
});

// 获取热门标签名称
router.get('/hotTags', async (ctx) => {
  ctx.body = await TagService.getHotTags()
});


// 获取用户的摘要信息
router.get('/u/:username/brief', async (ctx) => {
  ctx.body = await UserService.getUserBrief(ctx.params.username)
});

// 获取用户信息 
router.get('/u/:username', async (ctx) => {
  ctx.body = await UserService.getUserByName(ctx.params.username);
});
// 通过token获取user信息
router.get('/user/infos',async (ctx) => {
  ctx.body = await UserService.getUserById(ctx.state.user.id);
});

// 获取用户发布的信息汇总
router.get('/u/:uid/news', async (ctx) => {
  let [questions, answers] = await Promise.all([
    QaService.getQuestionsByUser(ctx.params.uid, {limit: 5}),
    QaService.getAnswersByUser(ctx.params.uid, {limit: 5})
  ]);
  ctx.body = { questions: questions[0], answers: answers[0] };
});

// 获取用户提出的问题
router.get('/u/:username/questions', async (ctx) => {
  let limit = +ctx.query.limit || 10;
  let [questions, count] = await QaService.getQuestionsByUser(ctx.params.username, {
    page: +ctx.query.page,
    limit: limit
  });
  ctx.body = {
    questions: questions,
    page: {
      currPage: +ctx.query.page || 1,
      pageNum: Math.ceil(count / limit),
      count: count
    }
  }
});

// 获取用户回答的答案
router.get('/u/:username/answers', async (ctx) => {
  let limit = +ctx.query.limit || 10;
  let [answers, count] = await QaService.getAnswersByUser(ctx.params.username, {
    page: +ctx.query.page,
    limit: limit
  });
  ctx.body = {
    answers: answers,
    page: {
      currPage: +ctx.query.page || 1,
      pageNum: Math.ceil(count / limit),
      count: count
    }
  }
});



// 搜索 ( ?text=....&type = ['question', 'user', 'tag'] )
router.get('/search', async (ctx) => {
  let limit = +ctx.query.limit || 10;
  let page = +ctx.query.page;
  let result, count;
  switch (ctx.query.type) {
    case 'question':
      [result, count] = await QaService.searchQuestions(ctx.query.text, {page: page, limit: limit});
      break;
    case 'user':
      [result, count]= await UserService.searchGeneralUsers(ctx.query.text,{page: page, limit: limit});
      break;
    case 'tag':
      [result, count] = await TagService.searchTags(ctx.query.text,{page: page, limit: limit});
      break;
    default:
      [result, count] = await QaService.searchQuestions(ctx.query.text,{page: page, limit: limit});
  }
  ctx.body = {
    result: result,
    page: {
      currPage: +ctx.query.page || 1,
      pageNum: Math.ceil(count / limit),
      count: count
    }
  }
  
});



// 登陆
router.post('/login', async (ctx) => {
  const form = ctx.request.body;
  // 判断username or email
  if(!form.username || !form.password) {
    return ctx.body = {code: 1, msg: '登陆失败'}
  }
  const user = await UserService.getUserByName(form.username);
  if(!user) {
    return ctx.body = {code: 1, msg: '该用户不存在'}
  }
  const isValid = await UserService.isValid(user, form.password);
  if(!isValid) {
    return ctx.body = { code: 1, msg: '密码错误'}
  }
  // TODO: 生成 token, 并写入session或local storage
  // console.info('登陆: ',user);
  const token = UserService.genToken(user);
  ctx.body = { code: 0, token: token };
});

// 注册
router.post('/register', async (ctx) => {
  const form = ctx.request.body;
  if(!form.username || !form.email || !form.password ) {
    return ctx.body = { code: 1, msg: '请认真填写表单,亲' }
  }
  const [u1, u2] = await Promise.all([
    UserService.getUserByName(form.username),
    UserService.getUserByEmail(form.email)
  ]);
  if(u1) return ctx.body = { code: 1, msg: '用户名已存在'};
  if(u2) return ctx.body = { code: 1, msg: '邮箱已存在'};

  const res = await UserService.register({
    username: form.username,
    password: form.password,
    email: form.email,
    info: {
      brief: '这个人很懒, 什么也没留下',
      photoAddress: 'http://graduation.b0.upaiyun.com/assets/no-avatar.jpg'
    }
  });
  if (res.code != 0) {
    return ctx.body = { code: 1, msg: '注册失败', errors: res.errors };
  }
  // 同样生成一个email token, 发送到用户的邮箱中
  const token = UserService.genToken(res.data);
  const mailToken = UserService.getEmailToken(res.data);
  UserService.sendMail(form.username, form.email, mailToken);
  ctx.body = { code: 0 , token: token};
  
});


// 检查登陆状态,并返回用户信息 (post)
router.post('/checkLogin', async (ctx) => {
  const form = ctx.request.body;
  if(!form.token) return ctx.body = {code: 1};
  const res = UserService.verifyToken(form.token);
  if(!res) return ctx.body = {code : 1};
  const userBrief = await UserService.getUserBriefById(res.id);
  ctx.body = { code: 0, userBrief: userBrief};
});

// 检查登陆状态, 并返回用户信息 (get)
router.get('/checkLogin', async (ctx) => {
  const form = ctx.query;
  if(!form.token) return ctx.body = {code: 1};
  const res = UserService.verifyToken(form.token);
  if(!res) return ctx.body = {code : 1, msg: '请登录'};
  const userBrief = await UserService.getUserBriefById(res.id);
  ctx.body = { code: 0, userBrief: userBrief};
});


router.post('/user/reSend', async (ctx) => {
  const user = await UserService.getUserById(ctx.state.user.id);
  const mailToken = UserService.getEmailToken(user);
  UserService.sendMail(user.username, user.email, mailToken);
  ctx.body = { code : 0 };
});

//
router.get('/genCaptchaToken', async(ctx) => {
  const number = parseInt(Math.random()*9000+1000);
  ctx.body = koaJwt.sign(number, cfg.secret+'captcha', {
    algorithm: 'HS256',
    noTimestamp: true
  });
});
// 生成验证码
router.get('/captcha', async (ctx) => {
  let token = ctx.query.r;
  console.log('token gen: ', token);
  try {
    const number = koaJwt.verify(token, cfg.secret+'captcha');
    ctx.body = UserService.genCaptcha(number);
    ctx.type = 'image/png';
  } catch (err) {
    console.info(err);
    return null;
  }
});

// 找回密码
router.post('/findPass', async (ctx) => {
  const { email, code, token } = ctx.request.body;
  let number = '';
  try {
    number = koaJwt.verify(token, cfg.secret+'captcha');
  }catch (err) {
    console.log(err);
    return ctx.body = { code: 1, msg: '请输入正确的验证码'};
  }

  console.log('token', token);
  console.log('number', number);
  console.log('code', code);
  if (code != number) return ctx.body = { code: 1, msg: '请输入正确的验证码'};
  const user = await UserService.getUserByEmail(email);
  if (!user) return ctx.body = { code: 1, msg: '这个邮箱并没有注册'};
  
  // sendMail
  const mailToken = UserService.getEmailToken(user);
  UserService.sendMail(user.username, user.email, mailToken);
  ctx.body = { code : 0 };
});

// 修改密码
router.post('/user/changePass', async (ctx) => {
  const form = ctx.request.body;
  console.log(form);
  const user = await UserService.getUserById(ctx.state.user.id);
  if (user.password != form.oldPassword) {
    console.log(user.password);
    console.log(form.oldPassword);
    return ctx.body = {code: 1, msg: '原密码错误'}
  }
  if(form.rePassword != form.newPassword) {
    return ctx.body = {code: 1, msg: '两次密码不一致'}
  }
  if(user.password == form.newPassword) {
    return ctx.body = {code: 1, msg: '新密码不要跟原密码一样'}
  }

  ctx.body = await UserService.updatePassword(ctx.state.user.id, form.newPassword);
});

// 修改邮箱
router.post('/user/changeEmail', async (ctx) => {
  const form = ctx.request.body;
  const res = UserService.verifyToken(form.token);
  if(!res) return ctx.body = {code : 1, msg: '请登录'};
  const user = await UserService.getUserById(res.id);
  // 向新邮箱中发送一封邮件 result = Util.sendMailTo( form.email );
  ctx.body = { code: 0 };

});


// 修改个人资料
router.post('/user/changeProfile', async (ctx) => {
  const infos =  ctx.request.body;
  ctx.body = await UserService.updateInfo(ctx.state.user.id, infos);
});

// 修改头像 , 只获取图片的crop信息 (前端需要验证401和code返回值)
router.post('/user/avatarPreUpload', async (ctx) => {
  const info = ctx.request.body;
  if (info.x && info.y && info.width && info.height) {
    const { policy, signature } = UserService.genAvatarInfos(info.x, info.y, info.width, info.height);
    ctx.body =  {code: 0, policy: policy, signature:signature}
  } else {
    ctx.body = { code: 1, msg: '上传出错了, 请刷新尝试'}
  }
});

router.post('/user/avatarUpload', async (ctx) => {
  const url = ctx.request.body.url;
  if (!url) return ctx.body = { code: 1, msg: '图片地址不能为空'};
  // 修改头像, 同时把所有qa表和comment表遍历一遍, 修改authorAvatar
  let res = await UserService.updateAvatar(ctx.state.user.id, url);
  if (res.code != 0)  return ctx.body = res;
  let user = await UserService.getUserById(ctx.state.user.id);
  Promise.all([
    QaService.updateAvatar(user.username, user.info.photoAddress),
    QaService.updateCommentAvatar(user.username, user.info.photoAddress)
  ]);
  ctx.body = res;
});

// TODO: 数据
// 提交答案
router.post('/user/answer', async (ctx) => {
  const user = await UserService.getUserById(ctx.state.user.id);
  const {answer, qid} = ctx.request.body;
  const res = await QaService.createAnswer(answer, qid, user);
  if(res.code != 0) return ctx.body = { code: 1, msg: '发表回答失败,请重新尝试', errors: res.errors};
  ctx.body = res;
});

// 评论
router.post('/user/reply', async (ctx) => {
  const user = await UserService.getUserById(ctx.state.user.id);
  const  {content, id} = ctx.request.body;
  const res = await QaService.createComment(content, id, user);
  if(res.code != 0) return ctx.body = { code: 1, msg: '发表评论失败,请重新尝试', errors: res.errors};
  ctx.body = res;
});

// 提交问题
router.post('/user/question', async (ctx) => {
  const user = await UserService.getUserById(ctx.state.user.id);
  const {tagStr, content, title} =ctx.request.body;
  const res = await QaService.createQuestion(title, content, tagStr.split(';'), user);
  if(res.code != 0) return ctx.body = { code: 1, msg: '发表问题失败,请重新尝试', errors: res.errors};
  ctx.body = res;
});



// 投票(喜欢点赞)


// 评论

// 修改头像





