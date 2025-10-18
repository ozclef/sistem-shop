// auth.js
// Usuarios ejemplo: al inicio ejecuta createDefaultAdmin() si users_pos no existe
function hashSimple(s){ // no es seguro para prod, pero evita ver plain text
  let h = 0;
  for(let i=0;i<s.length;i++){ h = ((h<<5)-h) + s.charCodeAt(i); h |= 0; }
  return 'h'+Math.abs(h);
}

function createDefaultAdmin(){
  const key='users_pos';
  if(localStorage.getItem(key)) return;
  const users = [
    {username:'admin', password_hash:hashSimple('admin123'), role:'admin'},
    {username:'cajero', password_hash:hashSimple('cajero123'), role:'cajero'},
    {username:'auditor', password_hash:hashSimple('auditor123'), role:'auditor'}
  ];
  localStorage.setItem(key, JSON.stringify(users));
}

function login(username, password){
  const users = JSON.parse(localStorage.getItem('users_pos') || '[]');
  const h = hashSimple(password||'');
  const u = users.find(x=> x.username===username && x.password_hash===h);
  if(!u) throw new Error('Usuario o contraseña inválidos');
  // store session (sessionStorage)
  sessionStorage.setItem('session_user', JSON.stringify({username:u.username, role:u.role}));
  recordAudit('login', u.username, {role:u.role});
  return u;
}
function logout(){
  const s = JSON.parse(sessionStorage.getItem('session_user')||'null');
  if(s) recordAudit('logout', s.username, {});
  sessionStorage.removeItem('session_user');
}
function currentUser(){
  return JSON.parse(sessionStorage.getItem('session_user') || 'null');
}
createDefaultAdmin();
