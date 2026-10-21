// Resolve before paint. A storage restriction must never block the page.
export const themeBootstrap = `(()=>{let t="system";try{const v=localStorage.getItem("subloom-landing-theme");if(v==="light"||v==="dark")t=v}catch{}const d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"})()`;
