
const form=document.getElementById("loginForm");
const error=document.getElementById("loginError");
const note=document.getElementById("loginLocalNote");

(async()=>{
  const ok=await GPKApi.health();
  if(!ok) note.hidden=false;
  else {
    try { await GPKApi.me(); location.href="index.html"; } catch (_) {}
  }
})();

form.addEventListener("submit",async e=>{
  e.preventDefault();
  error.hidden=true;
  try{
    await GPKApi.login(loginEmail.value.trim(),loginPassword.value);
    location.href="index.html";
  }catch(err){
    error.textContent=err.message;
    error.hidden=false;
  }
});
