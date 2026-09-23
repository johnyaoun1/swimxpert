// Hides app-root behind the #sx-boot splash on signed-in routes until Angular
// takes over, so nothing renders before the session is known. Must stay a plain
// blocking script in <head>: deferring it lets app-root paint first.
(function () {
  var path = location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/sessions/available' || path === '/checkout') return;
  var prefixes = [
    '/dashboard',
    '/admin',
    '/coach',
    '/change-password',
    '/quizzes',
    '/leaderboard',
    '/swimmer',
    '/my-sessions',
    '/payments',
    '/sessions'
  ];
  for (var i = 0; i < prefixes.length; i++) {
    var prefix = prefixes[i];
    if (path === prefix || path.indexOf(prefix + '/') === 0) {
      document.documentElement.classList.add('sx-booting');
      return;
    }
  }
})();
