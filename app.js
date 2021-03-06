import path from 'path'
import Koa from 'koa'
import mongoose from 'mongoose'
import convert from 'koa-convert'
import cors from 'kcors'
import morgan from 'koa-morgan'
import serve from 'koa-static'
import favicon from 'koa-favicon'
import etag from 'koa-etag'
import bodyparser from 'koa-bodyparser'
import conditional from 'koa-conditional-get'
import koaJwt from 'koa-jwt'

import router from './routes/router';
import adminRouter from './routes/adminRouter';
import apiRouter from './routes/apiRouter'
import errorHandler from './middlewares/errorHandler'
import nunjucks from './middlewares/nunjucks-2'
import auth from './middlewares/auth'

import dateFilter from './utils/filters/dateFilter'
import session from 'koa-generic-session'
import MongoStore from 'koa-generic-session-mongo'


import cfg from './config'

const app = new Koa();

app.keys = [cfg.secret];
// middleware
app.use(morgan('dev'));
app.use(cors());
app.use(convert(koaJwt({ secret: cfg.secret}).unless({ path: [
  // 主页
  '/', '/verify', '/login','/logout', /^\/admin/,
  // 静态文件
  /^\/css/, /^\/js/, /^\/images/, /^\/third/, /^\/upload/, /^\/public\/frontend/, '/favicon.ico',
  // 不需要验证的api接口
  /^\/api\/(?!user\/)/
]})));
app.use(conditional());
app.use(convert(bodyparser()));
app.use(etag());
app.use(serve(path.join(__dirname, '/public')));
app.use(favicon(__dirname + '/public/images/favicon.ico'));

app.use(convert(session({
  store: new MongoStore()
})));

//后台验证
app.use(auth('/admin'));

app.use(nunjucks({
  ext: 'html',
  path: path.join(__dirname, 'views'),
  nunjucksConfig: {
    autoescape: true,
    watch: true
  },
  configureEnvironment: (env) => {
    env.addFilter('dateFilter', dateFilter);
  }
}));

app.use(errorHandler());

// routes
app
  .use(router.routes())
  .use(router.allowedMethods());

app.use(apiRouter.routes())
   .use(router.allowedMethods());
app
  .use(adminRouter.routes());


var server = require('http').Server(app.callback()),
  io = require('socket.io')(server);


io.on('connection', function(socket){
  app.userCount =  app.userCount || 0;
  app.userCount += 1;
  console.log('当前在线人数  ', app.userCount);
  console.log('.............socket.io................');
  socket.on('disconnect',function(){
    app.userCount -= 1;
    console.log('当前在线人数  ', app.userCount);
  });
});

// app start
if(path.resolve('index.js') === module.parent.filename){
  mongoose.set('debug', true);
  mongoose.connect('mongodb://localhost/newQA');
  server.listen(3000, '0.0.0.0', () => console.log('server started http://localhost:3000'));
}


export default app

