// KAMPUS service worker: notifications persist after the page closes.
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('push', event => {
  let data = {title:'KAMPUS',body:'You have a new campus notification.',url:'/'};
  try { if (event.data) data = event.data.json(); }
  catch { if (event.data) data.body = event.data.text(); }
  const title = typeof data.title === 'string' ? data.title : 'KAMPUS';
  const body = typeof data.body === 'string' ? data.body : '';
  const url = typeof data.url === 'string' && data.url.startsWith('/') && !data.url.startsWith('//') ? data.url : '/';
  event.waitUntil(self.registration.showNotification(title, {
    body, icon:'/favicon.png',badge:'/favicon.png',tag:typeof data.tag === 'string' ? data.tag : undefined,
    data:{url}
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients => {
    for(const client of clients){
      if(new URL(client.url).origin === self.location.origin){
        await client.focus();
        if('navigate' in client) await client.navigate(url);
        return;
      }
    }
    return self.clients.openWindow(url);
  }));
});