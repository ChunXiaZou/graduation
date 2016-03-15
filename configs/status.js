const status = {
  1: { msg: "内部错误" },
  200: { msg: '没有提供用户名，或者用户名为空'},
  201: { msg: '没有提供密码，或者密码为空。'},
  202: { msg: '用户名已经被占用.'},
  203: { msg: '电子邮箱地址已经被占用'},
  204: { msg: '没有提供电子邮箱地址'},
  210: { msg: '用户名和密码不匹配。'},
  211: { msg: '找不到用户'},
  222: { msg: '表单信息不完善'},
  223: { msg: '表单校验失败'},
  403: { msg: '操作被禁止，因为 Class 权限限制。'},
  502: { msg: '服务器维护中'}

}
module.exports = status;
